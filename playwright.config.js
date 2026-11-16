import { defineConfig } from '@playwright/test'

// PW_PORT lets several worktrees run browser tests concurrently without
// reusing each other's dev servers.
const port = Number(process.env.PW_PORT || 9000)

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: `http://localhost:${port}`,
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `yarn dev --hostname localhost --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.PW_PORT,
    timeout: 60000
  },
  reporter: 'list'
})
