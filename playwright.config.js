import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:9000',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'yarn dev --hostname localhost --port 9000',
    url: 'http://localhost:9000',
    reuseExistingServer: true,
    timeout: 60000
  },
  reporter: 'list'
})
