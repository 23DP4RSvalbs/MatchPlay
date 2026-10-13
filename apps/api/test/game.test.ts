import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { WebSocket } from 'ws';
import { emptyTennis, tennisPoint, tennisLabel, type Match, type Profile } from '@matchplay/shared';
import { createApp } from '../src/app';
import { user } from '../src/schema';

const secret = 'local-test-secret-with-at-least-thirty-two-characters';
const venue = {
  name: 'Test Sports Hall',
  address: 'Riga, Test street 1',
  latitude: 56.9678,
  longitude: 24.1213,
  sports: ['Basketball', 'Tennis'],
  image: '/images/arena.webp',
  description: '',
};
const game = (venueId: string, sport = 'Basketball', capacity = 2) => ({
  venueId,
  title: 'Test evening game',
  sport,
  startsAt: new Date(Date.now() + 3_600_000).toISOString(),
  capacity,
  durationMinutes: 40,
});
type App = Awaited<ReturnType<typeof createApp>>;
async function register(ctx: App, name: string, email: string, role?: string) {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: 'http://localhost:5173' },
    payload: { name, email, password: 'TestPassword2026!', role },
  });
  assert.equal(response.statusCode, 200, response.body);
  const cookies = response.headers['set-cookie'];
  const cookie = (Array.isArray(cookies) ? cookies : [String(cookies)])
    .map((c) => c.split(';')[0])
    .join('; ');
  return { id: response.json().user.id as string, cookie };
}
function request(
  ctx: App,
  cookie: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: object,
) {
  return ctx.app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });
}

test('game lifecycle enforces permissions, broadcasts changes and keeps final results', async (t) => {
  const ctx = await createApp({ databasePath: ':memory:', secret });
  t.after(() => ctx.app.close());
  const host = await register(ctx, 'Test Host', 'host@test.local', 'admin');
  const captain = await register(ctx, 'Test Captain', 'captain@test.local');
  const player = await register(ctx, 'Test Player', 'player@test.local');
  const outsider = await register(ctx, 'Test Outsider', 'outsider@test.local');
  const admin = await register(ctx, 'Test Admin', 'admin@test.local');
  assert.equal(
    ctx.db.select().from(user).where(eq(user.id, host.id)).get()?.role,
    'player',
    'registration cannot assign admin',
  );
  ctx.db.update(user).set({ role: 'admin' }).where(eq(user.id, admin.id)).run();
  assert.equal((await ctx.app.inject({ url: '/api/profile' })).statusCode, 401);
  assert.equal((await request(ctx, host.cookie, 'GET', '/api/admin/users')).statusCode, 403);
  assert.equal(
    (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/matches',
        headers: { cookie: host.cookie, origin: 'https://untrusted.example' },
        payload: game('missing'),
      })
    ).statusCode,
    403,
  );
  const createdVenue = await request(ctx, admin.cookie, 'POST', '/api/admin/venues', venue);
  assert.equal(createdVenue.statusCode, 201, createdVenue.body);
  const venueId = createdVenue.json().id;
  assert.equal(
    (await request(ctx, admin.cookie, 'POST', '/api/admin/venues', { ...venue, latitude: 0 }))
      .statusCode,
    400,
  );
  const created = await request(ctx, host.cookie, 'POST', '/api/matches', game(venueId));
  assert.equal(created.statusCode, 201, created.body);
  const match = created.json<Match>();
  const path = `/api/matches/${match.id}`;
  assert.equal(
    (await request(ctx, outsider.cookie, 'POST', `${path}/chat`, { text: 'No membership' }))
      .statusCode,
    403,
  );
  assert.equal(
    (await request(ctx, outsider.cookie, 'POST', `${path}/control`, { action: 'start' }))
      .statusCode,
    403,
  );
  assert.equal(
    (await request(ctx, host.cookie, 'POST', `${path}/control`, { action: 'start' })).statusCode,
    409,
  );
  assert.equal(
    (
      await request(ctx, captain.cookie, 'POST', '/api/join-code', {
        code: match.code.toLowerCase(),
      })
    ).json().id,
    match.id,
  );
  assert.equal(
    (await request(ctx, player.cookie, 'POST', `${path}/join`, { side: 'orange' })).statusCode,
    200,
  );
  assert.equal(
    (await request(ctx, outsider.cookie, 'POST', `${path}/join`, { side: 'orange' })).statusCode,
    409,
    'capacity is enforced',
  );
  assert.equal(
    (await request(ctx, captain.cookie, 'POST', `${path}/join`, { side: 'blue' })).statusCode,
    200,
  );
  assert.equal(
    (await request(ctx, captain.cookie, 'POST', `${path}/join`, { side: 'blue' })).statusCode,
    409,
    'no duplicate membership',
  );
  assert.equal(
    (await request(ctx, host.cookie, 'POST', `${path}/member`, { userId: player.id, side: 'blue' }))
      .statusCode,
    200,
  );
  assert.equal(
    (
      await request(ctx, host.cookie, 'POST', `${path}/member`, {
        userId: player.id,
        side: 'orange',
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await request(ctx, host.cookie, 'POST', `${path}/captain`, { userId: captain.id })).statusCode,
    200,
  );
  const address = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
  const socket = new WebSocket(`${address.replace('http', 'ws')}${path}/stream`, {
    headers: { cookie: captain.cookie },
  });
  await once(socket, 'open');
  t.after(() => socket.terminate());
  const update = once(socket, 'message');
  await request(ctx, host.cookie, 'POST', `${path}/control`, { action: 'start' });
  assert.equal(JSON.parse(String((await update)[0])).type, 'changed');
  assert.equal(
    (
      await request(ctx, player.cookie, 'POST', `${path}/score`, {
        side: 'orange',
        delta: 1,
        requestId: randomUUID(),
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await request(ctx, captain.cookie, 'POST', `${path}/score`, {
        side: 'orange',
        delta: 1,
        requestId: randomUUID(),
      })
    ).statusCode,
    403,
  );
  const shot = { side: 'orange', delta: 3, requestId: randomUUID() };
  assert.equal(
    (await request(ctx, host.cookie, 'POST', `${path}/score`, shot)).json<Match>().orangeScore,
    3,
  );
  assert.equal(
    (await request(ctx, host.cookie, 'POST', `${path}/score`, shot)).json<Match>().orangeScore,
    3,
    'retry does not add points twice',
  );
  assert.equal(
    (
      await request(ctx, captain.cookie, 'POST', `${path}/score`, {
        side: 'blue',
        delta: 2,
        requestId: randomUUID(),
      })
    ).json<Match>().blueScore,
    2,
  );
  assert.equal(
    (
      await request(ctx, captain.cookie, 'POST', `${path}/score`, {
        side: 'blue',
        delta: -1,
        requestId: randomUUID(),
      })
    ).statusCode,
    403,
  );
  await request(ctx, host.cookie, 'POST', `${path}/score`, {
    side: 'orange',
    delta: -1,
    requestId: randomUUID(),
  });
  const paused = (
    await request(ctx, host.cookie, 'POST', `${path}/control`, { action: 'pause' })
  ).json<Match>();
  assert.equal(paused.clockStartedAt, null);
  assert.ok(paused.elapsedMs >= 0);
  assert.equal(
    (await request(ctx, host.cookie, 'POST', `${path}/control`, { action: 'resume' })).statusCode,
    200,
  );
  assert.equal(
    (await request(ctx, host.cookie, 'POST', `${path}/control`, { action: 'period' })).json<Match>()
      .period,
    2,
  );
  assert.equal(
    (await request(ctx, player.cookie, 'POST', `${path}/chat`, { text: 'Good game!' }))
      .json<Match>()
      .messages.at(-1)?.text,
    'Good game!',
  );
  const final = (
    await request(ctx, host.cookie, 'POST', `${path}/control`, { action: 'finish' })
  ).json<Match>();
  assert.equal(final.status, 'completed');
  assert.equal(final.orangeScore, 2);
  assert.equal(final.blueScore, 2);
  assert.ok(final.completedAt);
  assert.equal(
    (await request(ctx, host.cookie, 'POST', `${path}/control`, { action: 'finish' })).statusCode,
    200,
  );
  assert.equal(
    (
      await request(ctx, host.cookie, 'POST', `${path}/score`, {
        side: 'orange',
        delta: 1,
        requestId: randomUUID(),
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await request(ctx, host.cookie, 'POST', `${path}/member`, { userId: player.id, side: 'blue' }))
      .statusCode,
    409,
  );
  assert.equal((await request(ctx, host.cookie, 'GET', '/api/profile')).json<Profile>().played, 1);
  await request(ctx, admin.cookie, 'DELETE', `/api/admin/venues/${venueId}`);
  assert.equal((await request(ctx, '', 'GET', '/api/venues')).json().length, 0);
  assert.equal((await request(ctx, host.cookie, 'GET', path)).json<Match>().venueName, venue.name);
  assert.equal(
    (await request(ctx, admin.cookie, 'PATCH', `/api/admin/users/${player.id}`, { banned: true }))
      .statusCode,
    200,
  );
  assert.equal((await request(ctx, player.cookie, 'GET', '/api/profile')).statusCode, 401);
  assert.equal(
    (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: 'player@test.local', password: 'TestPassword2026!' },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await request(ctx, admin.cookie, 'PATCH', `/api/admin/users/${admin.id}`, { banned: true }))
      .statusCode,
    400,
  );
  socket.terminate();
});

test('tennis handles deuce, advantage and the 6-all tiebreak', () => {
  let state = emptyTennis();
  for (let i = 0; i < 3; i++) {
    state = tennisPoint(state, 'orange');
    state = tennisPoint(state, 'blue');
  }
  assert.equal(tennisLabel(state, 'orange'), '40');
  state = tennisPoint(state, 'orange');
  assert.equal(tennisLabel(state, 'orange'), 'AD');
  state = tennisPoint(state, 'blue');
  assert.equal(tennisLabel(state, 'orange'), '40');
  state = tennisPoint(tennisPoint(state, 'orange'), 'orange');
  assert.deepEqual(state.games, [1, 0]);
  state = { ...emptyTennis(), games: [6, 5] };
  for (let i = 0; i < 4; i++) state = tennisPoint(state, 'blue');
  assert.equal(state.tiebreak, true);
  for (let i = 0; i < 6; i++) {
    state = tennisPoint(state, 'orange');
    state = tennisPoint(state, 'blue');
  }
  state = tennisPoint(state, 'orange');
  assert.equal(state.tiebreak, true);
  state = tennisPoint(state, 'orange');
  assert.deepEqual(state.sets, [1, 0]);
  assert.deepEqual(state.games, [0, 0]);
});

test('sessions and completed games survive an API restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'matchplay-api-'));
  const path = join(directory, 'test.db');
  let ctx = await createApp({ databasePath: path, secret });
  try {
    const host = await register(ctx, 'Restart Host', 'restart-host@test.local');
    const blue = await register(ctx, 'Restart Blue', 'restart-blue@test.local');
    ctx.db.update(user).set({ role: 'admin' }).where(eq(user.id, host.id)).run();
    const venueId = (await request(ctx, host.cookie, 'POST', '/api/admin/venues', venue)).json().id;
    const match = (
      await request(ctx, host.cookie, 'POST', '/api/matches', game(venueId, 'Tennis'))
    ).json<Match>();
    const url = `/api/matches/${match.id}`;
    await request(ctx, blue.cookie, 'POST', `${url}/join`, { side: 'blue' });
    await request(ctx, host.cookie, 'POST', `${url}/control`, { action: 'start' });
    await request(ctx, host.cookie, 'POST', `${url}/score`, {
      side: 'orange',
      delta: 1,
      requestId: randomUUID(),
    });
    await request(ctx, host.cookie, 'POST', `${url}/score`, {
      side: 'blue',
      delta: 1,
      requestId: randomUUID(),
    });
    assert.equal(
      (
        await request(ctx, host.cookie, 'POST', `${url}/score`, {
          side: 'orange',
          delta: -1,
          requestId: randomUUID(),
        })
      ).statusCode,
      409,
    );
    assert.deepEqual(
      (
        await request(ctx, host.cookie, 'POST', `${url}/score`, {
          side: 'blue',
          delta: -1,
          requestId: randomUUID(),
        })
      ).json<Match>().tennis.points,
      [1, 0],
    );
    await request(ctx, host.cookie, 'POST', `${url}/control`, { action: 'finish' });
    await ctx.app.close();
    ctx = await createApp({ databasePath: path, secret });
    const restored = await request(ctx, host.cookie, 'GET', url);
    assert.equal(restored.statusCode, 200, restored.body);
    assert.equal(restored.json<Match>().status, 'completed');
    assert.deepEqual(restored.json<Match>().tennis.points, [1, 0]);
  } finally {
    await ctx.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
