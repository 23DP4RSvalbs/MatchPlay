import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  workers: 1,
  outputDir: join(tmpdir(), 'matchplay-test-results'),
  use: {
    baseURL: 'http://localhost:5174',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node --import tsx e2e/server.ts',
    url: 'http://localhost:5174/api/health',
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
