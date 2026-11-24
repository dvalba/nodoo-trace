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
  // Dos servidores: la readiness debe cubrir AMBOS. Con una sola entrada
  // (concurrently) Playwright solo esperaba a :4200, y el login del smoke
  // podía llegar antes de que el backend (:3001, nest --watch en frío)
  // escuchara: el proxy dev devolvía 500 y la UI mostraba un falso
  // "Credenciales inválidas". El probe es un endpoint público (sin auth).
  webServer: [
    {
      command: 'DB_NAME=supply_chain_e2e pnpm --filter backend start:dev',
      cwd: '..',
      url: 'http://localhost:3001/api/v1/activity-types',
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter nodoo-trace-web start',
      cwd: '..',
      url: 'http://localhost:4200',
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
