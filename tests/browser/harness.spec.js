// Self-tests for the browser harness: gotoRoute must never resolve before the
// destination (heading, workspace data, WorkspaceState mode) is ready.
import { test, expect } from '@playwright/test'
import {
  gotoRoute,
  mockApi,
  screenshotRoute,
  visibleH1Texts
} from './support/index.js'

const DELAY = 1500

test('delayed workspace API cannot make gotoRoute resolve early', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const { requests } = await mockApi(page, {
    delays: { 'workspace:finance': DELAY }
  })
  await gotoRoute(page, '/operations')
  const answered = []
  page.on('requestfinished', request => {
    if (request.url().includes('/api/workspace?name=finance'))
      answered.push(Date.now())
  })

  const { elapsed, workspace } = await gotoRoute(page, '/finance')
  const resolvedAt = Date.now()

  expect(elapsed).toBeGreaterThanOrEqual(DELAY - 100)
  expect(workspace).toEqual({ status: 200, failed: false })
  expect(answered).toHaveLength(1)
  expect(answered[0]).toBeLessThanOrEqual(resolvedAt)
  expect(requests.filter(r => r.key === 'workspace:finance')).toHaveLength(1)
  // Checked instantly (no auto-wait): the destination and its live data are
  // already on screen, and the previous route's heading is gone.
  expect(await visibleH1Texts(page)).toEqual(['Reconciliation and cash'])
  expect(await page.getByText('Live data').first().isVisible()).toBe(true)
  expect(
    await page.getByText('UGX 72,500', { exact: true }).first().isVisible()
  ).toBe(true)
  await screenshotRoute(page, 'finance', 375, '-delayed')
})

test('control: a bare .q-page wait resolves while the workspace is still pending', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockApi(page, { delays: { 'workspace:finance': DELAY } })
  await gotoRoute(page, '/operations')
  const started = Date.now()
  await page.goto('/#/finance')
  await page.locator('.q-page').first().waitFor()
  // The naive wait returned long before the delayed data could arrive.
  expect(Date.now() - started).toBeLessThan(DELAY)
  // Finance figures (unique to the delayed response) are not on screen yet.
  expect(
    await page.getByText('UGX 72,500', { exact: true }).first().isVisible()
  ).toBe(false)
})

test('gotoRoute waits for data-workspace-mode to leave loading/refreshing', async ({
  page
}) => {
  // The real WorkspaceState chip and banner stay in `loading` until the
  // delayed workspace answers; gotoRoute must not resolve before then.
  await page.setViewportSize({ width: 375, height: 812 })
  await mockApi(page, { delays: { 'workspace:finance': DELAY } })
  await gotoRoute(page, '/operations')
  await gotoRoute(page, '/finance')
  // Checked instantly (no auto-wait): every status element is already live.
  const modes = await page
    .locator('[data-workspace-mode]')
    .evaluateAll(nodes => nodes.map(node => node.dataset.workspaceMode))
  expect(modes.length).toBeGreaterThan(0)
  expect(modes.every(mode => mode === 'live')).toBe(true)
})

test('gotoRoute resolves on a failed workspace and reports the failure', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockApi(page, {
    failures: { 'workspace:finance': 503, 'workspace:retail': 'abort' }
  })
  const finance = await gotoRoute(page, '/finance')
  expect(finance.workspace).toEqual({ status: 503, failed: false })
  const retail = await gotoRoute(page, '/retail')
  expect(retail.workspace).toEqual({ status: 0, failed: true })
  expect(await visibleH1Texts(page)).toEqual(['Warehouse and retail stock'])
})

test('gotoRoute follows role redirects to the access-denied page', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockApi(page, { role: 'production_staff' })
  await gotoRoute(page, '/finance', { expectPath: '/access-denied' })
  await expect(page).toHaveURL(/#\/access-denied\?from=/)
})
