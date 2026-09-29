import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config } from 'dotenv';
import * as schema from './schema';

export const root = fileURLToPath(new URL('../../../', import.meta.url));
config({ path: resolve(root, '.env'), quiet: true });
export const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
export function openDatabase(
  path = resolve(root, process.env.DATABASE_PATH ?? 'data/matchplay.db'),
) {
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
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV === 'production')
    throw new Error('Set BETTER_AUTH_SECRET before starting in production.');
  const path = resolve(root, 'data/.auth-secret');
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) writeFileSync(path, randomBytes(32).toString('hex'), { flag: 'wx' });
  return readFileSync(path, 'utf8');
}
