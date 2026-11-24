import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  globalSetup: './scripts/reset-e2e-db.ts',
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    viewport: { width: 1440, height: 900 },
    video: 'on',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command:
      'concurrently "DB_NAME=supply_chain_e2e pnpm --filter backend start:dev" "pnpm --filter nodoo-trace-web start"',
    cwd: '..',
    url: 'http://localhost:4200',
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
