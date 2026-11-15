// Dashboard (/): workspace state, views, headings and reports.
import { test, expect } from '@playwright/test'
import {
  expectNoHorizontalOverflow,
  expectNoSkippedHeadingLevels,
  expectSingleH1,
  gotoRoute,
  mockApi
} from './support/index.js'

const PHONE = { width: 375, height: 812 }
const DESKTOP = { width: 1440, height: 900 }
const VIEWS = [
  { tab: 'Dashboard', heading: 'What needs attention now' },
  { tab: 'Weekly', heading: 'Weekly operations' },
  { tab: 'Monthly review', heading: 'Monthly business review' }
]

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const chip = page => page.locator('[data-workspace-mode] .status-chip')
const chipLabel = page => chip(page).locator('span').last()
const viewTab = (page, name) =>
  page.locator('[data-task-selector]').getByRole('tab', { name, exact: true })
const unavailableAlert = page => page.locator('.workspace-state__banner')
// The fixture retailer balance: 50,000 outstanding, a snapshot figure that is
// independent of the current calendar month.
const OUTSTANDING = 'UGX 50,000'

/** Answer the dashboard workspace through `handlers[n]` for the n-th call. */
function sequence(handlers) {
  let call = 0
  return (route, url, fixtures) =>
    handlers[Math.min(call++, handlers.length - 1)](route, fixtures)
}
const ok =
  (delay = 0) =>
  async (route, fixtures) => {
    if (delay) await wait(delay)
    return route.fulfill({ json: fixtures.workspaces.dashboard })
  }
const fail = status => route =>
  route.fulfill({ status, json: { error: `Mocked ${status} failure.` } })

test('320px: no overflow and every view is named and operable', async ({
  page
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await mockApi(page)
  await gotoRoute(page, '/')
  await expectNoHorizontalOverflow(page)

  for (const view of VIEWS) {
    const tab = viewTab(page, view.tab)
    await expect(tab).toBeVisible()
    await tab.click()
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(
      page.getByRole('heading', { level: 2, name: view.heading })
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
  await expect(page).toHaveURL(/view=review/)
  await page.reload()
  await expect(viewTab(page, 'Monthly review')).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(
    page.getByRole('heading', { level: 2, name: 'Monthly business review' })
  ).toBeVisible()

  // 200% text zoom: every view label stays whole and inside the viewport.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  for (const view of VIEWS) {
    const tab = viewTab(page, view.tab)
    await expect(tab).toBeVisible()
    const box = await tab.boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(320)
    const clipped = await tab.evaluate(el => {
      const label = el.querySelector('.task-selector__option-label')
      return label.scrollWidth > label.clientWidth + 1
    })
    expect(clipped, `${view.tab} label is clipped at 200% text`).toBe(false)
  }
  await viewTab(page, 'Weekly').click()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Weekly operations' })
  ).toBeVisible()
})

test('first load shows skeletons, never "Live data" or zero metrics', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  await mockApi(page, { delays: { 'workspace:dashboard': 2500 } })
  await page.goto('/#/')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Beecone dashboard' })
  ).toBeVisible()

  await expect(chipLabel(page)).toHaveText('Loading')
  await expect(chip(page)).toHaveAttribute('role', 'status')
  await expect(page.getByText('Live data')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('[data-dashboard-skeleton]')).toBeVisible()
  await expect(page.locator('.metric-strip dl')).toHaveCount(0)
  await expect(page.getByText(/UGX 0\b/)).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'What needs attention now' })
  ).toHaveCount(0)

  await expect(chipLabel(page)).toHaveText('Live data', { timeout: 10000 })
  await expect(page.locator('[data-dashboard-skeleton]')).toHaveCount(0)
  await expect(page.locator('.metric-strip dl')).toBeVisible()
  await expect(page.getByText(OUTSTANDING).first()).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 2, name: 'What needs attention now' })
  ).toBeVisible()
})

for (const { status, message } of [
  {
    status: 500,
    message: 'The service could not load this workspace. Retry in a moment.'
  },
  {
    status: 401,
    message: 'Your session has ended. Sign in again to load current data.'
  }
])
  test(`${status} shows a truthful unavailable state and retry recovers`, async ({
    page
  }) => {
    await page.setViewportSize(PHONE)
    await mockApi(page, {
      overrides: { 'workspace:dashboard': sequence([fail(status), ok()]) }
    })
    await gotoRoute(page, '/')

    const alert = unavailableAlert(page)
    await expect(alert).toHaveCount(1)
    await expect(page.getByRole('alert')).toHaveCount(1)
    await expect(alert).toContainText('Data unavailable.')
    await expect(alert).toContainText(message)
    await expect(chipLabel(page)).toHaveText('Unavailable')
    await expect(page.getByText('Live data')).toHaveCount(0)
    await expect(page.locator('.metric-strip')).toHaveCount(0)
    await expect(page.getByText(/UGX 0\b/)).toHaveCount(0)
    await expectSingleH1(page)

    await alert.getByRole('button', { name: 'Retry' }).click()
    await expect(chipLabel(page)).toHaveText('Live data')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByText(OUTSTANDING).first()).toBeVisible()
  })

test('refresh keeps loaded data; a failed refresh is stale, not live', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  await mockApi(page, {
    overrides: {
      'workspace:dashboard': sequence([ok(), ok(2000), fail(503)])
    }
  })
  await gotoRoute(page, '/')
  await expect(chipLabel(page)).toHaveText('Live data')
  await expect(page.getByText(OUTSTANDING).first()).toBeVisible()

  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(chipLabel(page)).toHaveText('Refreshing')
  await expect(page.getByText(OUTSTANDING).first()).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 2, name: 'What needs attention now' })
  ).toBeVisible()
  await expect(page.locator('[data-dashboard-skeleton]')).toHaveCount(0)
  await expect(chipLabel(page)).toHaveText('Live data', { timeout: 10000 })

  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  const alert = unavailableAlert(page)
  await expect(alert).toContainText(/Showing data from/)
  await expect(chipLabel(page)).toHaveText('Unavailable')
  await expect(page.getByText('Live data')).toHaveCount(0)
  await expect(page.getByText(OUTSTANDING).first()).toBeVisible()
})

for (const [size, viewport] of Object.entries({
  phone: PHONE,
  desktop: DESKTOP
}))
  test(`one h1 and no skipped heading levels in every view on ${size}`, async ({
    page
  }) => {
    await page.setViewportSize(viewport)
    await mockApi(page)
    await gotoRoute(page, '/')
    if (size === 'phone') {
      const toggle = page.getByRole('button', {
        name: 'Explore monthly trends'
      })
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await toggle.click()
      await expect(
        page.getByRole('button', { name: 'Hide trends' })
      ).toHaveAttribute('aria-expanded', 'true')
    }
    for (const view of VIEWS) {
      await viewTab(page, view.tab).click()
      await expect(
        page.getByRole('heading', { level: 2, name: view.heading })
      ).toBeVisible()
      if (view.tab === 'Weekly')
        await expect(
          page.getByRole('heading', { level: 3, name: 'Low materials' })
        ).toBeVisible()
      await expectSingleH1(page)
      await expectNoSkippedHeadingLevels(page)
    }
  })

test('roles without review access get no retailer or expense content', async ({
  page
}) => {
  await page.setViewportSize(DESKTOP)
  await mockApi(page, { role: 'production_staff' })
  await gotoRoute(page, '/')
  await expect(page.getByText('Jars packed')).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 3, name: 'Material lots' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Collections and in-store stock' })
  ).toHaveCount(0)
  await expect(page.getByText('Collections open now')).toHaveCount(0)
  await viewTab(page, 'Monthly review').click()
  await expect(
    page.getByText('Inventory at month end', { exact: true })
  ).toBeVisible()
  await expect(page.getByText('Expenses by category')).toHaveCount(0)
})

test('weekly reports use cards on phones and tables on desktop', async ({
  page
}) => {
  await mockApi(page)
  await page.setViewportSize({ width: 375, height: 844 })
  await gotoRoute(page, '/')
  await viewTab(page, 'Weekly').click()
  await page.getByText('Stock movement', { exact: true }).click()
  const cards = page.locator('.report-cards:visible').first()
  await expect(cards).toBeVisible()
  await expect(cards.getByRole('listitem')).toHaveCount(1)
  await expect(page.locator('.q-table')).toHaveCount(0)
  await page.setViewportSize({ width: 1280, height: 844 })
  await expect(page.locator('.q-table:visible').first()).toBeVisible()
  await expect(page.locator('.report-cards')).toHaveCount(0)
  await viewTab(page, 'Monthly review').click()
  await page.getByText('Inventory at month end', { exact: true }).click()
  await expect(page.getByText('Raw honey', { exact: true })).toBeVisible()
})
