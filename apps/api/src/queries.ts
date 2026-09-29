import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Match, MatchSummary, Person, Profile, Venue } from '@matchplay/shared';
import type { DatabaseContext } from './database';
import { matches, memberships, messages, user, venues } from './schema';
import { requireValue } from './errors';

type Db = DatabaseContext['db'];
export const person = (record: typeof user.$inferSelect): Person => ({
  id: record.id,
  name: record.name,
  email: record.email,
  role: record.role,
  banned: record.banned,
  city: record.city,
  createdAt: record.createdAt.toISOString(),
});
export function matchSummaries(db: Db): MatchSummary[] {
  return db
    .select({
      match: matches,
      venueName: venues.name,
      image: venues.image,
      memberCount: sql<number>`(select count(*) from memberships where match_id = ${matches.id})`,
    })
    .from(matches)
    .innerJoin(venues, eq(matches.venueId, venues.id))
    .orderBy(asc(matches.startsAt))
    .all()
    .map(({ match, venueName, image, memberCount }) => ({
      ...match,
      venueName,
      image,
      memberCount,
    }));
}
export function getMatch(db: Db, id: string): Match {
  const row = requireValue(
    db.select().from(matches).where(eq(matches.id, id)).get(),
    'Game not found.',
  );
  const venue = requireValue(db.select().from(venues).where(eq(venues.id, row.venueId)).get());
  const members = db
    .select({
      userId: memberships.userId,
      name: user.name,
      side: memberships.side,
      captain: memberships.captain,
    })
    .from(memberships)
    .innerJoin(user, eq(memberships.userId, user.id))
    .where(eq(memberships.matchId, id))
    .all()
    .sort(
      (a, b) =>
        Number(b.userId === row.hostId) - Number(a.userId === row.hostId) ||
        a.name.localeCompare(b.name),
    );
  const chat = db
    .select({
      id: messages.id,
      userId: user.id,
      name: user.name,
      text: messages.text,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(user, eq(messages.userId, user.id))
    .where(eq(messages.matchId, id))
    .orderBy(desc(messages.createdAt))
    .limit(100)
    .all()
    .reverse();
  return {
    ...row,
    venueName: venue.name,
    image: venue.image,
    memberCount: members.length,
    members,
    messages: chat,
    serverTime: new Date().toISOString(),
  };
}
export function getVenues(db: Db, includeInactive = false): Venue[] {
  const games = matchSummaries(db);
  return db
    .select()
    .from(venues)
    .where(includeInactive ? undefined : eq(venues.active, true))
    .all()
    .map((v) => ({
      ...v,
      latitude: v.latitude / 1e6,
      longitude: v.longitude / 1e6,
      rating: v.rating === null ? null : v.rating / 10,
      matches: games.filter(
        (m) => m.venueId === v.id && (m.status === 'lobby' || m.status === 'live'),
      ),
    }));
}
export function getProfile(db: Db, id: string): Profile {
  const record = requireValue(db.select().from(user).where(eq(user.id, id)).get());
  const joined = db.select().from(memberships).where(eq(memberships.userId, id)).all();
  const allGames = matchSummaries(db).filter((m) => joined.some((j) => j.matchId === m.id));
  const completed = allGames
    .filter((m) => m.status === 'completed')
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const won = (m: MatchSummary) =>
    joined.find((j) => j.matchId === m.id)?.side === 'orange'
      ? m.orangeScore > m.blueScore
      : m.blueScore > m.orangeScore;
  const most = (values: string[]) =>
    Object.entries(
      values.reduce<Record<string, number>>((out, v) => {
        out[v] = (out[v] ?? 0) + 1;
        return out;
      }, {}),
    ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No games yet';
  let streak = 0;
  for (const m of completed) {
    if (!won(m)) break;
    streak++;
  }
  return {
    user: person(record),
    played: completed.length,
    won: completed.filter(won).length,
    favoriteSport: most(completed.map((m) => m.sport)),
    topVenue: most(completed.map((m) => m.venueName)),
    streak,
    venuesVisited: new Set(completed.map((m) => m.venueId)).size,
    matches: allGames,
  };
}
export function bumpVersion(db: Db, id: string) {
  db.update(matches)
    .set({ version: sql`${matches.version} + 1` })
    .where(eq(matches.id, id))
    .run();
}
export function membership(db: Db, matchId: string, userId: string) {
  return db
    .select()
    .from(memberships)
    .where(and(eq(memberships.matchId, matchId), eq(memberships.userId, userId)))
    .get();
}
