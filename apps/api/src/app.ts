import Fastify, { type FastifyRequest } from 'fastify';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { fromNodeHeaders } from 'better-auth/node';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import { z } from 'zod';
import {
  chatSchema,
  createMatchSchema,
  elapsed,
  emptyTennis,
  joinSchema,
  scoreSchema,
  teamMemberSchema,
  tennisPoint,
  venueSchema,
} from '@matchplay/shared';
import { appUrl, openDatabase } from './database';
import { createAuth } from './auth';
import { AppError, requireValue } from './errors';
import {
  bumpVersion,
  getMatch,
  getProfile,
  getVenues,
  matchSummaries,
  membership,
  person,
} from './queries';
import { matches, memberships, messages, scoreEvents, session, user, venues } from './schema';

export async function createApp(
  options: { databasePath?: string; logger?: boolean; secret?: string } = {},
) {
  const { db, sqlite } = openDatabase(options.databasePath);
  const auth = createAuth(db, options.secret);
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 16_384 });
  const subscribers = new Map<string, Map<WebSocket, string>>();
  const publicSubscribers = new Set<WebSocket>();
  function refreshPublic() {
    for (const socket of publicSubscribers)
      if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'changed' }));
  }
  await app.register(websocket, { options: { maxPayload: 1024 } });
  await app.register(rateLimit, { max: 250, timeWindow: '1 minute' });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({ message: error.issues[0]?.message ?? 'Check the form.' });
    if (error instanceof AppError)
      return reply.code(error.statusCode).send({ message: error.message });
    const failure = error as { statusCode?: number; message?: string };
    const code = typeof failure.statusCode === 'number' ? failure.statusCode : 500;
    if (code >= 500) request.log.error(error);
    reply
      .code(code)
      .send({ message: code >= 500 ? 'Something went wrong. Please try again.' : failure.message });
  });
  app.addHook('onRequest', async (request) => {
    const origin = request.headers.origin;
    if (origin && origin !== appUrl)
      throw new AppError(403, 'This request came from an untrusted origin.');
  });
  async function currentUser(request: FastifyRequest) {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!result) throw new AppError(401, 'Sign in to continue.');
    const record = requireValue(db.select().from(user).where(eq(user.id, result.user.id)).get());
    if (record.banned) throw new AppError(403, 'This account is inactive.');
    return record;
  }
  async function admin(request: FastifyRequest) {
    const me = await currentUser(request);
    if (me.role !== 'admin') throw new AppError(403, 'Admin access required.');
    return me;
  }
  function broadcast(id: string) {
    refreshPublic();
    const room = subscribers.get(id);
    if (!room) return;
    const match = getMatch(db, id);
    for (const [socket, userId] of room) {
      const member = membership(db, id, userId);
      const record = db.select().from(user).where(eq(user.id, userId)).get();
      if (!record || record.banned || (!member && match.hostId !== userId)) {
        socket.close(1008, 'Membership ended');
        continue;
      }
      if (socket.readyState === 1)
        socket.send(JSON.stringify({ type: 'changed', id, version: match.version }));
    }
  }
  function hostGame(id: string, me: typeof user.$inferSelect) {
    const match = requireValue(
      db.select().from(matches).where(eq(matches.id, id)).get(),
      'Game not found.',
    );
    if (match.hostId !== me.id) throw new AppError(403, 'Only the organiser can do this.');
    return match;
  }
  const idFrom = (request: FastifyRequest) =>
    z.object({ id: z.string().min(1) }).parse(request.params).id;
  app.get('/api/health', async () => ({ status: 'ok', branch: 'Roberts' }));
  app.get('/api/events', { websocket: true }, (socket) => {
    publicSubscribers.add(socket);
    socket.send(JSON.stringify({ type: 'connected' }));
    socket.on('error', () => socket.close());
    socket.on('close', () => publicSubscribers.delete(socket));
  });
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) => {
      const response = await auth.handler(
        new Request(new URL(request.url, appUrl), {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        }),
      );
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header('set-cookie', cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });
  app.get('/api/me', async (request) => {
    try {
      return person(await currentUser(request));
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 401) return null;
      throw error;
    }
  });
  app.patch('/api/me', async (request) => {
    const me = await currentUser(request);
    const input = z
      .object({ name: z.string().trim().min(2).max(60), city: z.string().trim().min(2).max(60) })
      .parse(request.body);
    db.update(user)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(user.id, me.id))
      .run();
    return person(requireValue(db.select().from(user).where(eq(user.id, me.id)).get()));
  });
  app.get('/api/profile', async (request) => getProfile(db, (await currentUser(request)).id));
  app.get('/api/venues', async (request) => {
    const input = z
      .object({
        q: z.string().max(100).optional(),
        sport: z.string().optional(),
        bounds: z.string().optional(),
      })
      .parse(request.query);
    let result = getVenues(db);
    if (input.q) {
      const q = input.q.toLocaleLowerCase();
      result = result.filter((v) =>
        `${v.name} ${v.address} ${v.sports.join(' ')}`.toLocaleLowerCase().includes(q),
      );
    }
    if (input.sport) result = result.filter((v) => v.sports.some((s) => s === input.sport));
    if (input.bounds) {
      const b = input.bounds.split(',').map(Number);
      if (b.length !== 4 || b.some((n) => !Number.isFinite(n)))
        throw new AppError(400, 'Invalid map area.');
      result = result.filter(
        (v) =>
          v.longitude >= b[0] && v.latitude >= b[1] && v.longitude <= b[2] && v.latitude <= b[3],
      );
    }
    return result;
  });
  app.get('/api/venues/:id', async (request) =>
    requireValue(
      getVenues(db, true).find((v) => v.id === idFrom(request)),
      'Venue not found.',
    ),
  );
  app.get('/api/matches', async (request) => {
    const query = z
      .object({ status: z.enum(['lobby', 'live', 'completed', 'mine']).optional() })
      .parse(request.query);
    const all = matchSummaries(db).filter((m) => m.status !== 'cancelled');
    if (query.status === 'mine') {
      const me = await currentUser(request);
      const ids = db
        .select()
        .from(memberships)
        .where(eq(memberships.userId, me.id))
        .all()
        .map((m) => m.matchId);
      return all.filter((m) => ids.includes(m.id) || m.hostId === me.id);
    }
    return query.status ? all.filter((m) => m.status === query.status) : all;
  });
  app.get('/api/matches/:id', async (request) => {
    await currentUser(request);
    return getMatch(db, idFrom(request));
  });
  app.post('/api/matches', async (request, reply) => {
    const me = await currentUser(request);
    const input = createMatchSchema.parse(request.body);
    if (Date.parse(input.startsAt) < Date.now() - 60_000)
      throw new AppError(400, 'Choose a start time in the future.');
    const venue = requireValue(
      db.select().from(venues).where(eq(venues.id, input.venueId)).get(),
      'Venue not found.',
    );
    if (!venue.active || !venue.sports.includes(input.sport))
      throw new AppError(400, 'Choose a sport available at this venue.');
    const id = randomUUID();
    let code = randomBytes(3).toString('hex').toUpperCase();
    while (db.select().from(matches).where(eq(matches.code, code)).get())
      code = randomBytes(3).toString('hex').toUpperCase();
    db.transaction((tx) => {
      tx.insert(matches)
        .values({ ...input, id, code, hostId: me.id, tennis: emptyTennis() })
        .run();
      tx.insert(memberships)
        .values({ matchId: id, userId: me.id, side: 'orange', captain: true })
        .run();
    });
    refreshPublic();
    return reply.code(201).send(getMatch(db, id));
  });
  app.post('/api/join-code', async (request) => {
    await currentUser(request);
    const { code } = z.object({ code: z.string().trim().min(4).max(12) }).parse(request.body);
    const match = requireValue(
      db.select().from(matches).where(eq(matches.code, code.toUpperCase())).get(),
      'That game code was not found.',
    );
    if (match.status !== 'lobby')
      throw new AppError(409, 'This game is no longer accepting players.');
    return { id: match.id };
  });
  app.post('/api/matches/:id/join', async (request) => {
    const me = await currentUser(request);
    const id = idFrom(request);
    const { side } = joinSchema.parse(request.body);
    db.transaction((tx) => {
      const match = requireValue(tx.select().from(matches).where(eq(matches.id, id)).get());
      if (match.status !== 'lobby') throw new AppError(409, 'This game has already started.');
      if (membership(db, id, me.id))
        throw new AppError(409, 'You have already joined this game. Leave your team to switch.');
      const count = tx
        .select()
        .from(memberships)
        .where(and(eq(memberships.matchId, id), eq(memberships.side, side)))
        .all().length;
      if (count >= match.capacity)
        throw new AppError(409, 'This team is full. Try the other team.');
      tx.insert(memberships).values({ matchId: id, userId: me.id, side, captain: false }).run();
      bumpVersion(db, id);
    });
    broadcast(id);
    return getMatch(db, id);
  });
  app.post('/api/matches/:id/leave', async (request) => {
    const me = await currentUser(request);
    const id = idFrom(request);
    const match = getMatch(db, id);
    if (match.status !== 'lobby')
      throw new AppError(409, 'You can leave a team before the game starts.');
    if (match.hostId === me.id)
      throw new AppError(409, 'The organiser stays in the game. Use Cancel game to close it.');
    db.transaction((tx) => {
      tx.delete(memberships)
        .where(and(eq(memberships.matchId, id), eq(memberships.userId, me.id)))
        .run();
      bumpVersion(db, id);
    });
    broadcast(id);
    return getMatch(db, id);
  });
  app.post('/api/matches/:id/member', async (request) => {
    const me = await currentUser(request);
    const id = idFrom(request);
    const input = teamMemberSchema.parse(request.body);
    const match = hostGame(id, me);
    if (match.status !== 'lobby')
      throw new AppError(409, 'Teams are locked after the game starts.');
    db.transaction((tx) => {
      const member = requireValue(membership(db, id, input.userId), 'Player not found.');
      if (member.side === input.side) return;
      const count = tx
        .select()
        .from(memberships)
        .where(and(eq(memberships.matchId, id), eq(memberships.side, input.side)))
        .all().length;
      if (count >= match.capacity) throw new AppError(409, 'That team is full.');
      tx.update(memberships)
        .set({ side: input.side, captain: false })
        .where(and(eq(memberships.matchId, id), eq(memberships.userId, input.userId)))
        .run();
      bumpVersion(db, id);
    });
    broadcast(id);
    return getMatch(db, id);
  });
  app.post('/api/matches/:id/captain', async (request) => {
    const me = await currentUser(request);
    const id = idFrom(request);
    const match = hostGame(id, me);
    if (match.status === 'completed' || match.status === 'cancelled')
      throw new AppError(409, 'This game has ended.');
    const { userId } = z.object({ userId: z.string() }).parse(request.body);
    const member = requireValue(membership(db, id, userId), 'Player not found.');
    db.transaction((tx) => {
      tx.update(memberships)
        .set({ captain: false })
        .where(and(eq(memberships.matchId, id), eq(memberships.side, member.side)))
        .run();
      tx.update(memberships)
        .set({ captain: true })
        .where(and(eq(memberships.matchId, id), eq(memberships.userId, userId)))
        .run();
      bumpVersion(db, id);
    });
    broadcast(id);
    return getMatch(db, id);
  });
  app.post('/api/matches/:id/chat', async (request) => {
    const me = await currentUser(request);
    const id = idFrom(request);
    const input = chatSchema.parse(request.body);
    const match = getMatch(db, id);
    if (!membership(db, id, me.id) && match.hostId !== me.id)
      throw new AppError(403, 'Join a team to use match chat.');
    if (match.status === 'cancelled') throw new AppError(409, 'This game was cancelled.');
    db.transaction((tx) => {
      tx.insert(messages)
        .values({
          id: randomUUID(),
          matchId: id,
          userId: me.id,
          ...input,
          createdAt: new Date().toISOString(),
        })
        .run();
      bumpVersion(db, id);
    });
    broadcast(id);
    return getMatch(db, id);
  });
  app.post('/api/matches/:id/control', async (request) => {
    const me = await currentUser(request);
    const id = idFrom(request);
    const { action } = z
      .object({ action: z.enum(['start', 'pause', 'resume', 'period', 'finish', 'cancel']) })
      .parse(request.body);
    db.transaction((tx) => {
      const match = hostGame(id, me);
      const now = new Date().toISOString();
      if (action === 'finish' && match.status === 'completed') return;
      if (match.status === 'completed' || match.status === 'cancelled')
        throw new AppError(409, 'This game has ended.');
      if (action === 'start') {
        if (match.status !== 'lobby') throw new AppError(409, 'The game has already started.');
        const members = tx.select().from(memberships).where(eq(memberships.matchId, id)).all();
        if (!members.some((m) => m.side === 'orange') || !members.some((m) => m.side === 'blue'))
          throw new AppError(409, 'Both teams need at least one player.');
        tx.update(matches)
          .set({ status: 'live', clockStartedAt: now })
          .where(eq(matches.id, id))
          .run();
      } else if (action === 'cancel') {
        if (match.status !== 'lobby')
          throw new AppError(409, 'Only a game that has not started can be cancelled.');
        tx.update(matches).set({ status: 'cancelled' }).where(eq(matches.id, id)).run();
      } else {
        if (match.status !== 'live') throw new AppError(409, 'Start the game first.');
        if (action === 'pause') {
          if (!match.clockStartedAt) throw new AppError(409, 'The clock is already paused.');
          tx.update(matches)
            .set({ elapsedMs: elapsed(match), clockStartedAt: null })
            .where(eq(matches.id, id))
            .run();
        } else if (action === 'resume') {
          if (match.clockStartedAt) throw new AppError(409, 'The clock is already running.');
          tx.update(matches).set({ clockStartedAt: now }).where(eq(matches.id, id)).run();
        } else if (action === 'period') {
          if (match.period >= 10) throw new AppError(400, 'Maximum period reached.');
          tx.update(matches)
            .set({ period: match.period + 1 })
            .where(eq(matches.id, id))
            .run();
        } else if (action === 'finish')
          tx.update(matches)
            .set({
              status: 'completed',
              completedAt: now,
              elapsedMs: elapsed(match),
              clockStartedAt: null,
            })
            .where(eq(matches.id, id))
            .run();
      }
      bumpVersion(db, id);
    });
    broadcast(id);
    return getMatch(db, id);
  });
  app.post('/api/matches/:id/score', async (request) => {
    const me = await currentUser(request);
    const id = idFrom(request);
    const input = scoreSchema.parse(request.body);
    db.transaction((tx) => {
      const match = requireValue(tx.select().from(matches).where(eq(matches.id, id)).get());
      const member = membership(db, id, me.id);
      if (match.hostId !== me.id && (!member?.captain || member.side !== input.side))
        throw new AppError(403, "Only this team's captain can add points.");
      const duplicate = tx
        .select()
        .from(scoreEvents)
        .where(eq(scoreEvents.id, input.requestId))
        .get();
      if (duplicate) {
        if (
          duplicate.matchId === id &&
          duplicate.userId === me.id &&
          duplicate.side === input.side &&
          duplicate.delta === input.delta
        )
          return;
        throw new AppError(409, 'That scoring request was already used.');
      }
      if (match.status !== 'live')
        throw new AppError(409, 'Points can only be entered during a live game.');
      if (input.delta < 0 && match.hostId !== me.id)
        throw new AppError(403, 'Only the organiser can correct a score.');
      if (match.sport !== 'Basketball' && Math.abs(input.delta) !== 1)
        throw new AppError(400, 'This sport uses one point at a time.');
      if (match.sport === 'Tennis') {
        let next = tennisPoint(match.tennis, input.side);
        if (input.delta < 0) {
          const last = tx
            .select()
            .from(scoreEvents)
            .where(eq(scoreEvents.matchId, id))
            .orderBy(desc(sql`rowid`))
            .get();
          if (!last?.before || last.delta < 0 || last.side !== input.side)
            throw new AppError(409, 'Only the most recent tennis point can be undone.');
          next = last.before;
        }
        tx.update(matches)
          .set({ tennis: next, orangeScore: next.sets[0], blueScore: next.sets[1] })
          .where(eq(matches.id, id))
          .run();
      } else {
        const score = (input.side === 'orange' ? match.orangeScore : match.blueScore) + input.delta;
        if (score < 0) throw new AppError(400, 'A score cannot be below zero.');
        tx.update(matches)
          .set(input.side === 'orange' ? { orangeScore: score } : { blueScore: score })
          .where(eq(matches.id, id))
          .run();
      }
      tx.insert(scoreEvents)
        .values({
          id: input.requestId,
          matchId: id,
          userId: me.id,
          side: input.side,
          delta: input.delta,
          before: match.tennis,
          createdAt: new Date().toISOString(),
        })
        .run();
      bumpVersion(db, id);
    });
    broadcast(id);
    return getMatch(db, id);
  });
  app.get(
    '/api/matches/:id/stream',
    {
      websocket: true,
      preValidation: async (request) => {
        const me = await currentUser(request);
        const id = idFrom(request);
        const match = getMatch(db, id);
        if (match.hostId !== me.id && !membership(db, id, me.id))
          throw new AppError(403, 'Join this game to receive live updates.');
        (request as FastifyRequest & { streamUserId: string }).streamUserId = me.id;
      },
    },
    (socket, request) => {
      const id = idFrom(request);
      const userId = (request as FastifyRequest & { streamUserId: string }).streamUserId;
      const room = subscribers.get(id) ?? new Map<WebSocket, string>();
      room.set(socket, userId);
      subscribers.set(id, room);
      socket.send(JSON.stringify({ type: 'connected', id, version: getMatch(db, id).version }));
      socket.on('error', () => socket.close());
      socket.on('close', () => {
        room.delete(socket);
        if (!room.size) subscribers.delete(id);
      });
    },
  );
  app.get('/api/admin/users', async (request) => {
    await admin(request);
    return db.select().from(user).orderBy(desc(user.createdAt)).all().map(person);
  });
  app.patch('/api/admin/users/:id', async (request) => {
    const me = await admin(request);
    const id = idFrom(request);
    const input = z
      .object({ name: z.string().trim().min(2).max(60).optional(), banned: z.boolean().optional() })
      .parse(request.body);
    requireValue(db.select().from(user).where(eq(user.id, id)).get());
    if (id === me.id && input.banned)
      throw new AppError(400, 'You cannot deactivate your own admin account.');
    db.transaction((tx) => {
      tx.update(user)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(user.id, id))
        .run();
      if (input.banned) tx.delete(session).where(eq(session.userId, id)).run();
    });
    if (input.banned)
      for (const room of subscribers.values())
        for (const [socket, userId] of room)
          if (userId === id) socket.close(1008, 'Account inactive');
    return person(requireValue(db.select().from(user).where(eq(user.id, id)).get()));
  });
  app.get('/api/admin/venues', async (request) => {
    await admin(request);
    return getVenues(db, true);
  });
  app.post('/api/admin/venues', async (request, reply) => {
    await admin(request);
    const input = venueSchema.parse(request.body);
    const id = randomUUID();
    db.insert(venues)
      .values({
        ...input,
        id,
        latitude: Math.round(input.latitude * 1e6),
        longitude: Math.round(input.longitude * 1e6),
      })
      .run();
    refreshPublic();
    return reply.code(201).send(requireValue(getVenues(db, true).find((v) => v.id === id)));
  });
  app.patch('/api/admin/venues/:id', async (request) => {
    await admin(request);
    const id = idFrom(request);
    requireValue(db.select().from(venues).where(eq(venues.id, id)).get());
    const input = venueSchema.extend({ active: z.boolean() }).parse(request.body);
    db.update(venues)
      .set({
        ...input,
        latitude: Math.round(input.latitude * 1e6),
        longitude: Math.round(input.longitude * 1e6),
      })
      .where(eq(venues.id, id))
      .run();
    refreshPublic();
    return requireValue(getVenues(db, true).find((v) => v.id === id));
  });
  app.delete('/api/admin/venues/:id', async (request) => {
    await admin(request);
    const id = idFrom(request);
    requireValue(db.select().from(venues).where(eq(venues.id, id)).get());
    db.update(venues).set({ active: false }).where(eq(venues.id, id)).run();
    refreshPublic();
    return { ok: true };
  });
  app.addHook('onClose', () => {
    for (const socket of publicSubscribers) socket.close();
    for (const room of subscribers.values()) for (const socket of room.keys()) socket.close();
    sqlite.close();
  });
  await app.ready();
  return { app, db, sqlite, auth };
}
