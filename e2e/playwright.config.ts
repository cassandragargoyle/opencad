import { defineConfig, devices } from '@playwright/test';

// Override when 5173 is taken by another dev server, e.g. E2E_PORT=5180.
const PORT = Number(process.env.E2E_PORT ?? 5173);

export default defineConfig({
  testDir: '.',
  // house-build.spec.ts is an experiment harness, run explicitly with ITER=<id>
  testIgnore: process.env.ITER ? [] : ['house-build.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }],
    ['list'],
  ],
  webServer: {
    // In CI: serve the pre-built dist; locally: use the Vite dev server
    command: process.env.CI
      ? `pnpm --filter=@opencad/app exec vite preview --port ${PORT} --strictPort`
      : `pnpm --filter=@opencad/app dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
