import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { emptyTennis } from '@matchplay/shared';
import { createApp } from './app';
import { matches, memberships, messages, user, venues } from './schema';

const context = await createApp();
const { db, auth, app } = context;
const demo = [
  ['roberts', 'Roberts H.', 'player'],
  ['janis', 'Janis Kristaps', 'player'],
  ['andris', 'Andris B.', 'player'],
  ['captain', 'Roberts Z.', 'player'],
  ['player', 'Anna L.', 'player'],
  ['admin', 'MatchPlay Admin', 'admin'],
] as const;
const ids: Record<string, string> = {};
for (const [key, name, role] of demo) {
  const email = `${key}@matchplay.local`;
  let record = db.select().from(user).where(eq(user.email, email)).get();
  if (!record) {
    await auth.api.signUpEmail({ body: { name, email, password: 'MatchPlay2026!' } });
    record = db.select().from(user).where(eq(user.email, email)).get();
  }
  if (!record) throw new Error(`Could not create ${key}`);
  ids[key] = record.id;
  db.update(user).set({ role, emailVerified: true }).where(eq(user.id, record.id)).run();
}
const venueData = [
  {
    id: 'riga-arena',
    name: 'Riga Arena Sports Hall',
    address: 'Skanstes iela 21, Riga',
    latitude: 56_967880,
    longitude: 24_121340,
    sports: ['Basketball', 'Football', 'Volleyball', 'Tennis'] as const,
    image: '/images/arena.webp',
    rating: 48,
    reviewCount: 142,
    description: 'An indoor court in the heart of Skanste. Bring your team and make it a game.',
  },
  {
    id: 'hanzas',
    name: 'Hanzas Vidusskolas Laukums',
    address: 'Grostonas iela 5, Riga',
    latitude: 56_966441,
    longitude: 24_118433,
    sports: ['Football'] as const,
    image: '/images/football.webp',
    rating: 46,
    reviewCount: 86,
    description: 'A neighbourhood football ground with room for a proper evening kickabout.',
  },
  {
    id: 'olympic',
    name: 'Rimi Olympic Centre',
    address: 'Grostonas iela 6B, Riga',
    latitude: 56_967659,
    longitude: 24_124561,
    sports: ['Basketball', 'Volleyball'] as const,
    image: '/images/arena.webp',
    rating: 47,
    reviewCount: 94,
    description: 'Indoor sports halls close to Riga Arena. Meet up for basketball or volleyball.',
  },
];
for (const v of venueData)
  db.insert(venues)
    .values({ ...v, sports: [...v.sports] })
    .onConflictDoNothing()
    .run();
const future = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
if (!db.select().from(matches).where(eq(matches.id, 'midweek-hoops')).get()) {
  db.transaction((tx) => {
    tx.insert(matches)
      .values({
        id: 'midweek-hoops',
        code: 'HOOPS6',
        title: 'Midweek Hoop Session',
        venueId: 'riga-arena',
        hostId: ids.janis,
        sport: 'Basketball',
        startsAt: future(74),
        capacity: 5,
        orangeName: 'Team Orange',
        blueName: 'Team Blue',
        tennis: emptyTennis(),
      })
      .run();
    for (const [key, side, captain] of [
      ['janis', 'orange', true],
      ['andris', 'orange', false],
      ['captain', 'blue', true],
    ] as const)
      tx.insert(memberships)
        .values({ matchId: 'midweek-hoops', userId: ids[key], side, captain })
        .run();
    tx.insert(messages)
      .values({
        id: randomUUID(),
        matchId: 'midweek-hoops',
        userId: ids.janis,
        text: 'Everyone bring a white and dark shirt!',
        createdAt: new Date().toISOString(),
      })
      .run();
    tx.insert(matches)
      .values({
        id: 'evening-football',
        code: 'KICK24',
        title: 'Evening Five-a-side',
        venueId: 'hanzas',
        hostId: ids.roberts,
        sport: 'Football',
        startsAt: future(180),
        capacity: 5,
        orangeName: 'Team Orange',
        blueName: 'Team Blue',
        durationMinutes: 60,
        tennis: emptyTennis(),
      })
      .run();
    for (const [key, side, captain] of [
      ['roberts', 'orange', true],
      ['andris', 'orange', false],
      ['player', 'blue', true],
    ] as const)
      tx.insert(memberships)
        .values({ matchId: 'evening-football', userId: ids[key], side, captain })
        .run();
    tx.insert(matches)
      .values({
        id: 'live-hoops',
        code: 'LIVE78',
        title: 'Skanste Court Run',
        venueId: 'riga-arena',
        hostId: ids.janis,
        sport: 'Basketball',
        startsAt: new Date(Date.now() - 38 * 60_000).toISOString(),
        status: 'live',
        capacity: 5,
        orangeName: 'Team Orange',
        blueName: 'Team Blue',
        orangeScore: 78,
        blueScore: 74,
        period: 4,
        elapsedMs: 2_266_000,
        clockStartedAt: null,
        tennis: emptyTennis(),
      })
      .run();
    for (const [key, side, captain] of [
      ['janis', 'orange', true],
      ['roberts', 'orange', false],
      ['captain', 'blue', true],
    ] as const)
      tx.insert(memberships)
        .values({ matchId: 'live-hoops', userId: ids[key], side, captain })
        .run();
    for (let i = 0; i < 24; i++) {
      const id = `history-${i}`;
      const won = i < 16;
      const at = new Date(Date.now() - (i + 1) * 86_400_000).toISOString();
      tx.insert(matches)
        .values({
          id,
          code: `HIST${String(i).padStart(2, '0')}`,
          title: i % 3 ? 'Evening Hoop Session' : 'Weekend Court Run',
          venueId: i % 5 ? 'riga-arena' : 'olympic',
          hostId: ids.janis,
          sport: 'Basketball',
          startsAt: at,
          completedAt: at,
          status: 'completed',
          capacity: 5,
          orangeName: 'Team Orange',
          blueName: 'Team Blue',
          orangeScore: won ? 78 + i : 62 + i,
          blueScore: won ? 71 + i : 70 + i,
          elapsedMs: 2_400_000,
          tennis: emptyTennis(),
        })
        .run();
      for (const [key, side] of [
        ['roberts', 'orange'],
        ['janis', 'orange'],
        ['captain', 'blue'],
      ] as const)
        tx.insert(memberships)
          .values({ matchId: id, userId: ids[key], side, captain: key !== 'roberts' })
          .run();
    }
  });
}
await app.close();
console.log('Demo venues, matches and accounts ready. Password: MatchPlay2026!');
