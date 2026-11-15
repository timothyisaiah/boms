// Distribution workspace (/retail): stock issues to retail partners.
import { test, expect } from '@playwright/test'
import {
  chooseOption,
  createFixtures,
  createUser,
  expectNoHorizontalOverflow,
  expectNoSkippedHeadingLevels,
  expectSingleH1,
  gotoRoute,
  mockApi
} from './support/index.js'
import { mockRetailApi } from './support/retail-mocks.js'

const PHONE = { width: 375, height: 812 }
const SMALL_PHONE = { width: 320, height: 568 }
const DESKTOP = { width: 1280, height: 844 }
const DRAFT_KEY = 'boms:draft:test:retail:stock-issue'
const TASKS = ['Issue stock', /^Dispatches/, /^Movements/, 'Snapshot']

const taskTab = (page, name) =>
  page.getByRole('tab', { name, exact: typeof name === 'string' })

const historyRequests = (requests, resource) =>
  requests.filter(
    request =>
      request.key === 'history' &&
      new URL(request.url, 'http://x').searchParams.get('resource') === resource
  )

const readDraft = page =>
  page.evaluate(key => sessionStorage.getItem(key), DRAFT_KEY)

test('issue stock form lists live finished batches on a phone', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  await mockApi(page)
  await gotoRoute(page, '/retail')
  await taskTab(page, 'Issue stock').click()
  await page.getByLabel('Finished batch', { exact: true }).click()
  await expect(
    page.getByRole('option').filter({ hasText: 'PB-20260910' })
  ).toBeVisible()
})

test('375px: task selector is in the first viewport and the form starts by 600px', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  await mockRetailApi(page)
  await gotoRoute(page, '/retail')
  const selector = await page.locator('[data-task-selector]').boundingBox()
  const form = await page.locator('form.stock-issue__form').boundingBox()
  const heading = await page
    .getByRole('heading', { level: 2, name: 'Issue stock to a retailer' })
    .boundingBox()
  test.info().annotations.push({
    type: 'positions@375',
    description: `selector ${Math.round(selector.y)}–${Math.round(
      selector.y + selector.height
    )}px, form heading ${Math.round(heading.y)}px, form ${Math.round(form.y)}px`
  })
  expect(selector.y + selector.height).toBeLessThanOrEqual(PHONE.height)
  await expect(taskTab(page, 'Issue stock')).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(form.y).toBeLessThanOrEqual(600)
  await expectSingleH1(page)
  await expectNoSkippedHeadingLevels(page)
})

test('320px names every task without horizontal swiping', async ({ page }) => {
  await page.setViewportSize(SMALL_PHONE)
  await mockRetailApi(page)
  await gotoRoute(page, '/retail')
  for (const name of TASKS) {
    const tab = taskTab(page, name)
    await expect(tab).toBeVisible()
    const box = await tab.boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(SMALL_PHONE.width)
  }
  await expect(taskTab(page, /^Dispatches/)).toHaveText(/Dispatches \(1\)/)
  await expect(taskTab(page, /^Movements/)).toHaveText(/Movements \(1\)/)
  await expectNoHorizontalOverflow(page)
})

test('?view=movements direct link restores the view and back returns to it', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  const { requests } = await mockRetailApi(page)
  await gotoRoute(page, '/retail?view=movements', { expectPath: '/retail' })
  await expect(taskTab(page, /^Movements/)).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(
    page.getByRole('heading', { level: 2, name: 'Movement history' })
  ).toBeVisible()
  await expect(page.locator('[data-row-key="1"]')).toContainText(
    'Ntinda Health Market'
  )
  expect(historyRequests(requests, 'retailerMovements').length).toBe(1)
  expect(
    requests.some(
      request =>
        request.key === 'workspace:retail' &&
        request.url.includes('view=summary')
    )
  ).toBe(true)

  await taskTab(page, /^Dispatches/).click()
  await expect(page).toHaveURL(/view=dispatches/)
  await expect(page.locator('[data-row-key="1"]')).toContainText('DN-001')
  await gotoRoute(page, '/')
  await page.goBack()
  await expect(page).toHaveURL(/#\/retail\?view=dispatches/)
  await expect(taskTab(page, /^Dispatches/)).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(
    page.getByRole('heading', { level: 2, name: 'Dispatch records' })
  ).toBeVisible()
})

test('stock-issue draft survives a same-user reload and clears after save', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  page.on('dialog', dialog => dialog.accept())
  const { requests } = await mockRetailApi(page)
  const posted = []
  await page.route('**/api/write?*', async route => {
    posted.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, json: { id: 77 } })
  })
  await gotoRoute(page, '/retail')
  await chooseOption(page, 'Retail partner', 'Ntinda')
  await chooseOption(page, 'Finished batch', 'PB-20260910')
  await page.getByLabel('Jars issued', { exact: true }).fill('4')
  await page
    .getByLabel('Dispatch reference', { exact: true })
    .fill('VAN-DRAFT-1')
  await expect.poll(() => readDraft(page)).toContain('VAN-DRAFT-1')
  expect(await readDraft(page)).not.toMatch(/idempotency/i)

  await gotoRoute(page, '/retail')
  await expect(page.getByText('Draft restored from this device.')).toBeVisible()
  await expect(
    page.getByLabel('Dispatch reference', { exact: true })
  ).toHaveValue('VAN-DRAFT-1')
  await expect(page.getByLabel('Jars issued', { exact: true })).toHaveValue('4')
  await expect(page.getByLabel('Retail partner', { exact: true })).toHaveValue(
    /Ntinda Health Market/
  )

  const summaryReads = () =>
    requests.filter(request => request.key === 'workspace:retail').length
  const readsBeforeSave = summaryReads()
  await page.getByRole('button', { name: 'Issue stock', exact: true }).click()
  await expect.poll(() => posted.length).toBe(1)
  expect(posted[0]).toEqual({
    retailerId: 1,
    issuedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/),
    issueReference: 'VAN-DRAFT-1',
    notes: '',
    items: [{ production_output_id: 1, quantity: 4 }]
  })
  await expect.poll(() => readDraft(page)).toBeNull()
  await expect.poll(summaryReads).toBeGreaterThan(readsBeforeSave)
  await expect(
    page.getByLabel('Dispatch reference', { exact: true })
  ).toHaveValue('')
  await expect(page.getByText('Draft restored from this device.')).toHaveCount(
    0
  )
})

test('another signed-in user never sees the stock-issue draft', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  page.on('dialog', dialog => dialog.accept())
  let user = createUser('warehouse_staff')
  await mockRetailApi(page, {
    overrides: {
      auth: route => route.fulfill({ json: { user } })
    }
  })
  await gotoRoute(page, '/retail')
  await page
    .getByLabel('Dispatch reference', { exact: true })
    .fill('PRIVATE-REF')
  await expect.poll(() => readDraft(page)).toContain('PRIVATE-REF')

  user = { ...createUser('sales_or_distribution_staff'), id: 'other-user' }
  await gotoRoute(page, '/retail')
  await expect(
    page.getByLabel('Dispatch reference', { exact: true })
  ).toHaveValue('')
  await expect(page.getByText('Draft restored from this device.')).toHaveCount(
    0
  )
  expect(await readDraft(page)).toBeNull()
  const keys = await page.evaluate(() => Object.keys(sessionStorage))
  expect(keys.filter(key => key.startsWith('boms:draft:'))).toEqual([])
})

test('a failed submit lists the errors and focuses the first invalid field', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  let writes = 0
  await mockRetailApi(page)
  await page.route('**/api/write?*', route => {
    writes++
    return route.fulfill({ status: 201, json: { id: 1 } })
  })
  await gotoRoute(page, '/retail')
  await page.getByRole('button', { name: 'Issue stock', exact: true }).click()
  const summary = page.getByRole('alert').filter({
    hasText: 'Check the highlighted fields'
  })
  await expect(summary).toBeVisible()
  await expect(
    summary.getByRole('link', { name: /^Retail partner:/ })
  ).toBeVisible()
  await expect(
    summary.getByRole('link', { name: /^Finished batch:/ })
  ).toBeVisible()
  await expect(
    summary.getByRole('link', { name: /^Jars issued:/ })
  ).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id))
    .toBe('stock-issue-retailer')

  // Business rule (not a field rule): more jars than the batch has open.
  await chooseOption(page, 'Retail partner', 'Ntinda')
  await chooseOption(page, 'Finished batch', 'PB-20260910')
  await page.getByLabel('Jars issued', { exact: true }).fill('25')
  await page.getByRole('button', { name: 'Issue stock', exact: true }).click()
  await expect(
    summary.getByRole('link', {
      name: 'Line 1: One of the selected batches no longer has enough open stock for this issue.'
    })
  ).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id))
    .toBe('stock-issue-line-1-quantity')
  expect(writes).toBe(0)
})

test('desktop dispatch table pages, sorts and searches on the server', async ({
  page
}) => {
  await page.setViewportSize(DESKTOP)
  const fixtures = createFixtures()
  const base = fixtures.workspaces.retail.stockIssues[0]
  fixtures.workspaces.retail.stockIssues = Array.from(
    { length: 30 },
    (_, index) => ({
      ...base,
      id: index + 1,
      issue_reference: `DN-${String(index + 1).padStart(3, '0')}`,
      total_quantity: index + 1,
      issued_at: new Date(Date.UTC(2026, 8, 1 + index, 12)).toISOString()
    })
  )
  const { requests } = await mockRetailApi(page, { fixtures })
  await gotoRoute(page, '/retail?view=dispatches', { expectPath: '/retail' })
  const table = page.locator('.q-table')
  await expect(table).toBeVisible()
  await expect(table.getByRole('row')).toHaveCount(26)
  const params = () =>
    historyRequests(requests, 'stockIssues').map(
      request => new URL(request.url, 'http://x').searchParams
    )
  expect(params()[0].get('limit')).toBe('25')
  expect(params()[0].get('offset')).toBe('0')
  expect(params()[0].get('sort')).toBeNull()
  await expect(page.getByText(/1.25 of 30/)).toBeVisible()

  await page.getByRole('button', { name: /next page/i }).click()
  await expect.poll(() => params().at(-1)?.get('offset')).toBe('25')
  await expect(page.getByText(/26.30 of 30/)).toBeVisible()

  await table.getByRole('columnheader', { name: /^Jars/ }).click()
  await expect.poll(() => params().at(-1)?.get('sort')).toBe('total_quantity')
  expect(params().at(-1).get('order')).toBe('asc')

  await page.getByLabel('Search dispatches').fill('DN-007')
  await expect.poll(() => params().at(-1)?.get('q')).toBe('DN-007')
  expect(params().at(-1).get('offset')).toBe('0')
  await expect(table.getByRole('row')).toHaveCount(2)
  await expect(table).toContainText('DN-007')
})

test('finance_accountant can review distribution but sees no write actions', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  await mockRetailApi(page, { role: 'finance_accountant' })
  await gotoRoute(page, '/retail')
  await expect(taskTab(page, /^Dispatches/)).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.getByRole('tab', { name: 'Issue stock' })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'New stock issue' })
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Issue stock', exact: true })
  ).toHaveCount(0)
  await expect(page.locator('form.stock-issue__form')).toHaveCount(0)
  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(
    page.getByRole('button', { name: 'Refresh workspace' })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add retailer' })).toHaveCount(
    0
  )
  await expect(
    page.getByRole('button', { name: 'Manage retailers' })
  ).toHaveCount(0)
  await page.keyboard.press('Escape')

  await gotoRoute(page, '/retail?view=issue', {
    expectPath: '/retail',
    workspace: null
  })
  await expect(page).not.toHaveURL(/view=issue/)
  await expect(page.locator('form.stock-issue__form')).toHaveCount(0)
})

test('snapshot balances include active retailers holding zero units', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  const fixtures = createFixtures()
  fixtures.workspaces.retail.retailers.push({
    id: 2,
    retailer_name: 'Kira Corner Shop',
    delivery_location: 'Kira, Wakiso'
  })
  const { requests } = await mockRetailApi(page, { fixtures })
  await gotoRoute(page, '/retail?view=snapshot', { expectPath: '/retail' })
  const balances = page.locator('[data-retailer-balances]')
  await expect(balances.locator('[data-retailer-id="1"]')).toContainText(
    '15 jars on hand'
  )
  await expect(balances.locator('[data-retailer-id="1"]')).toContainText(
    'TEST-500 / PB-20260910-001 / 15 jars'
  )
  await expect(balances.locator('[data-retailer-id="2"]')).toContainText(
    'Kira Corner Shop'
  )
  await expect(balances.locator('[data-retailer-id="2"]')).toContainText(
    '0 jars on hand'
  )
  const recent = historyRequests(requests, 'retailerMovements')
  expect(recent).toHaveLength(1)
  expect(new URL(recent[0].url, 'http://x').searchParams.get('limit')).toBe('8')
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'Recent retailer ledger entries'
    })
  ).toBeVisible()
  await expectSingleH1(page)
  await expectNoSkippedHeadingLevels(page)
})

test('retailer management stays reachable from the overflow menu', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  await mockRetailApi(page)
  await gotoRoute(page, '/retail')
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('button', { name: 'Add retailer' }).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('heading', { name: 'Add retailer' })
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('button', { name: 'Manage retailers' }).click()
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Manage retailers' })
  ).toBeVisible()
})
