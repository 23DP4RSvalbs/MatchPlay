import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config } from 'dotenv';
import * as schema from './schema';

const appEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().url().default('http://localhost:5173'),
  ),
  DATABASE_PATH: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().default('data/matchplay.db'),
  ),
  BETTER_AUTH_SECRET: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(32).optional(),
  ),
});

export const root = fileURLToPath(new URL('../../../', import.meta.url));
config({ path: resolve(root, '.env'), quiet: true });

export const env = appEnvSchema.parse({
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? 'development',
});

export const appUrl = env.APP_URL;

export function resolveDatabasePath(path?: string) {
  const target = path ?? env.DATABASE_PATH;
  return target === ':memory:' ? ':memory:' : resolve(root, target);
}

export function openDatabase(path = resolveDatabasePath()) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: resolve(root, 'apps/api/drizzle') });
  return { db, sqlite };
}
export type DatabaseContext = ReturnType<typeof openDatabase>;
export function authSecret() {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  if (env.NODE_ENV === 'production')
    throw new Error('Set BETTER_AUTH_SECRET before starting in production.');
  const path = resolve(root, 'data/.auth-secret');
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) {
    writeFileSync(path, randomBytes(32).toString('hex'), { flag: 'wx' });
  }
  const secret = readFileSync(path, 'utf8').trim();
  if (secret.length < 32) {
    const replacement = randomBytes(32).toString('hex');
    writeFileSync(path, replacement, { flag: 'w' });
    return replacement;
  }
  return secret;
}
