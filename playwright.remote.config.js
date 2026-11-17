import { defineConfig, devices } from '@playwright/test'

const PORT = 4174
const AUTH_PORT = 3001
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e/remote',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 40_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: `AUTH_SECRET=e2e-test-secret AUTH_ALLOWED_ORIGIN=http://127.0.0.1:${PORT} AUTH_DATA_DIR=$(mktemp -d) PORT=${AUTH_PORT} node server/index.mjs`,
      url: `http://127.0.0.1:${AUTH_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `VITE_AUTH_API_URL=http://127.0.0.1:${AUTH_PORT} npm run build && npm run preview -- --port ${PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})