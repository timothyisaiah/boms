// Finance workspace (/finance): reconciliation, remittance, expenses.
import { test, expect } from '@playwright/test'
import {
  chooseOption,
  gotoRoute,
  mockApi,
  mockFinanceHistory,
  reconciliationRows
} from './support/index.js'

test('reconciliation price is readonly and counts use numeric keypads', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page)
  await gotoRoute(page, '/finance')
  await page.getByRole('tab', { name: /Reconciliation/ }).click()
  await expect(
    page.getByLabel('Variant price on reconciliation date')
  ).toHaveAttribute('readonly', '')
  await expect(page.getByLabel('Expired', { exact: true })).toHaveAttribute(
    'inputmode',
    'numeric'
  )
})

test('reconciliation explains every jar and preserves the write payload', async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  const { requests } = await mockApi(page)
  await gotoRoute(page, '/finance')

  await chooseOption(page, 'Retail partner', 'Ntinda Health Market')
  await chooseOption(page, 'Issued stock line', 'DN-001')

  const accounting = page.locator('[data-accounting-state]')
  await expect(accounting).toHaveAttribute('data-accounting-state', 'balanced')
  await expect(accounting.locator('[data-accounting="opening"]')).toHaveText(
    '10'
  )
  await expect(
    accounting.locator('[data-accounting="unaccounted"]')
  ).toHaveText('0')

  await page.getByLabel('Sold', { exact: true }).fill('3')
  await page.getByLabel('Remaining', { exact: true }).fill('6')
  await expect(accounting).toHaveAttribute('data-accounting-state', 'under')
  await expect(accounting).toContainText('1 jar unaccounted')

  await page.getByRole('button', { name: 'Record reconciliation' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Each line must fully explain the retailer stock currently on hand'
  )
  expect(
    requests.filter(request => request.key === 'write:reconciliations')
  ).toHaveLength(0)

  await page.getByLabel('Remaining', { exact: true }).fill('8')
  await expect(accounting).toHaveAttribute('data-accounting-state', 'over')
  await expect(accounting).toContainText('Over by 1 jar')

  await page.getByLabel('Remaining', { exact: true }).fill('7')
  await expect(accounting).toHaveAttribute('data-accounting-state', 'balanced')
  await expect(accounting).toContainText('All 10 jars accounted for')
  await page.getByRole('button', { name: 'Record reconciliation' }).click()

  await expect(page.locator('[data-save-confirmation]')).toContainText(
    'Reconciliation recorded'
  )
  await expect(
    page.getByRole('button', {
      name: 'Record payment for this reconciliation'
    })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Start another reconciliation' })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'View records' })).toBeVisible()

  const write = requests.find(
    request => request.key === 'write:reconciliations'
  )
  expect(write).toBeTruthy()
  expect(JSON.parse(write.body)).toMatchObject({
    retailerId: 1,
    items: [
      {
        stock_issue_item_id: 1,
        quantity_sold: 3,
        quantity_returned: 0,
        quantity_damaged: 0,
        quantity_expired: 0,
        quantity_remaining: 7
      }
    ]
  })
})

test('finance forms restore separate user-scoped drafts', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await mockApi(page)
  await gotoRoute(page, '/finance')

  await page.getByLabel('Reconciliation reference').fill('REC-DRAFT-ONLY')
  await page.getByRole('tab', { name: 'Remittance', exact: true }).click()
  await page.getByLabel('Payment reference').fill('PAY-DRAFT-ONLY')
  await page.getByRole('tab', { name: 'Expense', exact: true }).click()
  await page.getByLabel('Expense category').fill('Fuel draft')
  await page.waitForTimeout(500)
  await page.reload()

  await expect(page.getByText('Draft restored.')).toBeVisible()
  await expect(page.getByLabel('Expense category')).toHaveValue('Fuel draft')

  await page.getByRole('tab', { name: 'Reconciliation', exact: true }).click()
  await expect(page.getByText(/Draft restored/)).toBeVisible()
  await expect(page.getByLabel('Reconciliation reference')).toHaveValue(
    'REC-DRAFT-ONLY'
  )

  await page.getByRole('tab', { name: 'Remittance', exact: true }).click()
  await expect(page.getByText(/Draft restored/)).toBeVisible()
  await expect(page.getByLabel('Payment reference')).toHaveValue(
    'PAY-DRAFT-ONLY'
  )
})

test('finance records page and search on the server', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page)
  const requests = await mockFinanceHistory(page, {
    reconciliations: reconciliationRows('Ntinda Health Market', 26),
    remittances: [],
    expenses: []
  })
  await gotoRoute(page, '/finance')
  await page.getByRole('tab', { name: /Records/ }).click()

  const records = page.locator('[data-history="reconciliations"]')
  await expect(records.getByText('REC-001', { exact: true })).toBeVisible()
  await expect(records.getByText('REC-026', { exact: true })).toHaveCount(0)

  await records.getByRole('button', { name: /(?:Go to page )?2/ }).click()
  await expect(records.getByText('REC-026', { exact: true })).toBeVisible()
  expect(
    requests.some(
      url =>
        url.searchParams.get('resource') === 'reconciliations' &&
        url.searchParams.get('offset') === '25'
    )
  ).toBe(true)

  await page.getByLabel('Search reconciliations').fill('REC-003')
  await expect(records.getByText('REC-003', { exact: true })).toBeVisible()
  await expect(records.getByText('REC-026', { exact: true })).toHaveCount(0)
  expect(
    requests.some(
      url =>
        url.searchParams.get('resource') === 'reconciliations' &&
        url.searchParams.get('q') === 'REC-003' &&
        url.searchParams.get('offset') === '0'
    )
  ).toBe(true)
})

test('read-only management receives review tasks without write forms', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page, { role: 'read_only_management' })
  await mockFinanceHistory(page)
  await gotoRoute(page, '/finance')

  const selector = page.locator('[data-task-selector]')
  await expect(selector.getByRole('tab')).toHaveCount(2)
  await expect(selector.getByRole('tab', { name: /Records/ })).toBeVisible()
  await expect(selector.getByRole('tab', { name: 'Snapshot' })).toBeVisible()
  await expect(
    selector.getByRole('tab', { name: 'Reconciliation' })
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Record reconciliation' })
  ).toHaveCount(0)
})

test('consignment jars show their shelf value, not as sales', async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await mockApi(page)
  await gotoRoute(page, '/finance?view=snapshot', { expectPath: '/finance' })
  await expect(page.getByText('On retailer shelves')).toBeVisible()
  await expect(page.getByText('10 jars, not yet sold')).toBeVisible()
  await expect(page.locator('[data-shelf-value]')).toHaveText(/UGX\s?200,000/)
  await expect(page.getByText('Shelf value at cost')).toBeVisible()
  await expect(
    page.getByText('count as sales only when a check-in records them sold')
  ).toBeVisible()
})
