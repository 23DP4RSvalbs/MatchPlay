import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';

const directory = mkdtempSync(join(tmpdir(), 'matchplay-browser-'));
const env = {
  ...process.env,
  DATABASE_PATH: join(directory, 'test.db'),
  APP_URL: 'http://localhost:5174',
  API_PORT: '3002',
  BETTER_AUTH_SECRET: 'browser-test-secret-at-least-thirty-two-characters',
};
const seed = spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/seed.ts'], {
  env,
  stdio: 'inherit',
});
const [code] = await once(seed, 'exit');
if (code !== 0) process.exit(Number(code ?? 1));
const api = spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/index.ts'], {
  env,
  stdio: 'inherit',
});
const web = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'apps/web',
    '--host',
    'localhost',
    '--port',
    '5174',
    '--strictPort',
  ],
  { env, stdio: 'inherit' },
);
function stop() {
  api.kill();
  web.kill();
  process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
api.on('exit', stop);
web.on('exit', stop);
