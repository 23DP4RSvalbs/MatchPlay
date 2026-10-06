import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import type { MatchStatus, Sport, TeamSide, TennisState } from '@matchplay/shared';

const date = (name: string) => integer(name, { mode: 'timestamp_ms' }).notNull();
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: date('created_at'),
  updatedAt: date('updated_at'),
  role: text('role').notNull().default('player'),
  banned: integer('banned', { mode: 'boolean' }).notNull().default(false),
  city: text('city').notNull().default('Riga'),
});
export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: date('expires_at'),
    token: text('token').notNull().unique(),
    createdAt: date('created_at'),
    updatedAt: date('updated_at'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_idx').on(table.userId)],
);
export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: date('created_at'),
    updatedAt: date('updated_at'),
  },
  (table) => [
    index('account_user_idx').on(table.userId),
    uniqueIndex('account_provider_idx').on(table.providerId, table.accountId),
  ],
);
export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: date('expires_at'),
    createdAt: date('created_at'),
    updatedAt: date('updated_at'),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);
export const venues = sqliteTable(
  'venues',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    latitude: integer('latitude_e6').notNull(),
    longitude: integer('longitude_e6').notNull(),
    sports: text('sports', { mode: 'json' }).$type<Sport[]>().notNull(),
    image: text('image').notNull(),
    rating: integer('rating_tenths'),
    reviewCount: integer('review_count').notNull().default(0),
    description: text('description').notNull().default(''),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [index('venue_bounds_idx').on(table.active, table.latitude, table.longitude)],
);
export const matches = sqliteTable(
  'matches',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    title: text('title').notNull(),
    venueId: text('venue_id')
      .notNull()
      .references(() => venues.id),
    hostId: text('host_id')
      .notNull()
      .references(() => user.id),
    sport: text('sport').$type<Sport>().notNull(),
    startsAt: text('starts_at').notNull(),
    status: text('status').$type<MatchStatus>().notNull().default('lobby'),
    capacity: integer('capacity').notNull(),
    orangeName: text('orange_name').notNull(),
    blueName: text('blue_name').notNull(),
    orangeScore: integer('orange_score').notNull().default(0),
    blueScore: integer('blue_score').notNull().default(0),
    durationMinutes: integer('duration_minutes').notNull().default(40),
    elapsedMs: integer('elapsed_ms').notNull().default(0),
    clockStartedAt: text('clock_started_at'),
    period: integer('period').notNull().default(1),
    tennis: text('tennis', { mode: 'json' }).$type<TennisState>().notNull(),
    version: integer('version').notNull().default(0),
    completedAt: text('completed_at'),
  },
  (table) => [
    index('match_venue_status_idx').on(table.venueId, table.status, table.startsAt),
    index('match_status_idx').on(table.status),
  ],
);
export const memberships = sqliteTable(
  'memberships',
  {
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    side: text('side').$type<TeamSide>().notNull(),
    captain: integer('captain', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.userId] }),
    index('membership_user_idx').on(table.userId),
  ],
);
export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    text: text('text').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('message_match_idx').on(table.matchId, table.createdAt)],
);
export const scoreEvents = sqliteTable(
  'score_events',
  {
    id: text('id').primaryKey(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    side: text('side').$type<TeamSide>().notNull(),
    delta: integer('delta').notNull(),
    before: text('before', { mode: 'json' }).$type<TennisState>(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('score_match_idx').on(table.matchId, table.createdAt)],
);
