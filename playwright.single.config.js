import { defineConfig, devices } from '@playwright/test'

const PORT = 4175
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e/single',
  fullyParallel: false,
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
  webServer: {
    command: `npm run build && AUTH_SECRET=e2e-single-secret AUTH_DATA_DIR=$(mktemp -d) PORT=${PORT} node server/index.mjs`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})