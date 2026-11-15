// Operations workspace (/operations): receipts and production batches.
import { test, expect } from '@playwright/test'
import {
  chooseOption,
  expectNoHorizontalOverflow,
  expectNoSkippedHeadingLevels,
  expectSingleH1,
  gotoRoute,
  mockApi
} from './support/index.js'
import { makePurchases, operationsMocks } from './support/operations-mocks.js'

const OPERATIONS = { expectPath: '/operations' }
const draftKey = form => `boms:draft:test:operations:${form}`
const storedDraft = (page, form) =>
  page.evaluate(key => sessionStorage.getItem(key), draftKey(form))

/** mockApi with the summary view and paged /api/history. */
async function mockOperations(page, options = {}) {
  const { history, ...rest } = options
  const mocks = operationsMocks({ history })
  const api = await mockApi(page, {
    fixtures: mocks.fixtures,
    ...rest,
    overrides: { ...mocks.overrides, ...rest.overrides }
  })
  return { ...api, ...mocks }
}

test('phone receipt uses inline validation and retries the original action only once', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 844 })
  await mockApi(page)
  const calls = []
  await page.route('**/api/write?*', async route => {
    calls.push({
      key: route.request().headers()['idempotency-key'],
      body: route.request().postDataJSON()
    })
    if (calls.length === 1) await route.abort('failed')
    else await route.fulfill({ status: 201, json: { id: 123 } })
  })
  await gotoRoute(page, '/operations')
  await page.getByRole('tab', { name: 'Receipt form' }).click()
  await page
    .getByRole('button', { name: 'Record purchase', exact: true })
    .click()
  await expect(page.getByText('This field is required.').first()).toBeVisible()
  expect(calls).toHaveLength(0)
  await chooseOption(page, 'Supplier', 'Honey Cooperative')
  await chooseOption(page, 'Material', 'Raw Honey')
  await page.getByLabel('Quantity', { exact: true }).fill('10')
  await page.getByLabel('Unit cost (UGX)', { exact: true }).fill('10000')
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveAttribute(
    'inputmode',
    'decimal'
  )
  await page
    .getByRole('button', { name: 'Record purchase', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Retry saved submission' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Record purchase', exact: true })
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Retry saved submission' }).click()
  await expect(page.getByText('Saved successfully.')).toBeVisible()
  expect(calls).toHaveLength(2)
  expect(calls[0]).toEqual(calls[1])
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('')
})

test('recipe inputs prefill and stay editable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page)
  await gotoRoute(page, '/operations')
  await page.getByRole('tab', { name: 'Batch form' }).click()
  await chooseOption(page, 'Finished variant', '500g Classic Jar')
  await page.getByLabel('Jars produced', { exact: true }).fill('20')
  await expect(page.getByLabel('Quantity consumed').first()).toHaveValue(
    '10.000'
  )
  await page.getByLabel('Quantity consumed').first().fill('10.2')
  await expect(page.getByLabel('Quantity consumed').first()).toHaveValue('10.2')
})

test('at 375px the task selector and the active form start in the first viewport', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockOperations(page)
  await gotoRoute(page, '/operations')
  const selector = await page.locator('[data-task-selector]').boundingBox()
  expect(selector.y + selector.height).toBeLessThanOrEqual(812)
  const receipt = await page
    .getByRole('heading', { name: 'Record a material receipt' })
    .boundingBox()
  expect(receipt.y).toBeLessThanOrEqual(600)
  await page.getByRole('tab', { name: 'Batch form' }).click()
  const batch = await page
    .getByRole('heading', { name: 'Create a production batch' })
    .boundingBox()
  expect(batch.y).toBeLessThanOrEqual(600)
  test.info().annotations.push({
    type: 'positions@375',
    description: `selector top ${Math.round(selector.y)}px, bottom ${Math.round(
      selector.y + selector.height
    )}px; receipt form top ${Math.round(receipt.y)}px; batch form top ${Math.round(batch.y)}px`
  })
  await expectSingleH1(page)
  await expectNoSkippedHeadingLevels(page)
})

test('at 320px every task is named without horizontal swiping', async ({
  page
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await mockOperations(page)
  await gotoRoute(page, '/operations')
  const options = page.locator(
    '[data-task-selector] .task-selector__phone [role="tab"]'
  )
  await expect(options.locator('.task-selector__option-label')).toHaveText([
    'Receipt form',
    'Batch form',
    'Purchases (1)',
    'Batches (1)',
    'Snapshot'
  ])
  for (const box of await options.evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().toJSON())
  )) {
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(320)
  }
  await expectNoHorizontalOverflow(page)
})

test('?view=batches restores the view, and back/forward follow the selection', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const { historyRequests } = await mockOperations(page)
  await gotoRoute(page, '/operations?view=batches', OPERATIONS)
  await expect(page.getByRole('tab', { name: 'Batches (1)' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.locator('[data-row-key="1"]')).toContainText(
    'PB-20260910-001'
  )
  expect(historyRequests.some(r => r.resource === 'batches')).toBe(true)
  await page.getByRole('tab', { name: 'Snapshot' }).click()
  await expect(page).toHaveURL(/view=snapshot/)
  await expect(
    page.getByRole('heading', { name: 'Open material lots' })
  ).toBeVisible()
  // A fresh entry, then browser back returns to the batches view.
  await page.goto('/#/operations?view=purchases')
  await expect(
    page.getByRole('tab', { name: 'Purchases (1)' })
  ).toHaveAttribute('aria-selected', 'true')
  await page.goBack()
  await expect(page.getByRole('tab', { name: 'Snapshot' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
})

test('batch draft survives reload for the same user and clears after save', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockOperations(page)
  const posted = []
  await page.route('**/api/write?*', async route => {
    posted.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, json: { id: 7 } })
  })
  page.on('dialog', dialog => dialog.accept())
  await gotoRoute(page, '/operations?view=batch-entry', OPERATIONS)
  const code = await page.getByLabel('Batch code', { exact: true }).inputValue()
  await chooseOption(page, 'Finished variant', '500g Classic Jar')
  await page.getByLabel('Jars produced', { exact: true }).fill('20')
  await page.getByLabel('Batch notes', { exact: true }).fill('Morning run')
  await expect.poll(() => storedDraft(page, 'batch')).toContain('Morning run')
  const stored = JSON.parse(await storedDraft(page, 'batch'))
  expect(stored.identity).toBe('test')
  expect(stored.data).not.toHaveProperty('batchCode')
  expect(JSON.stringify(stored)).not.toMatch(/idempotency/i)

  await page.reload()
  await expect(page.getByText('Draft restored from this device.')).toBeVisible()
  await expect(page.getByLabel('Batch notes', { exact: true })).toHaveValue(
    'Morning run'
  )
  await expect(page.getByLabel('Jars produced', { exact: true })).toHaveValue(
    '20'
  )
  await expect(page.getByLabel('Quantity consumed').first()).toHaveValue(
    '10.000'
  )
  await expect(page.getByLabel('Batch code', { exact: true })).toHaveValue(code)

  await page
    .getByRole('button', { name: 'Create production batch', exact: true })
    .click()
  await expect.poll(() => posted.length).toBe(1)
  expect(posted[0]).toMatchObject({
    variantId: 1,
    batchCode: code,
    outputQuantity: 20,
    notes: 'Morning run'
  })
  await expect(page.getByLabel('Batch notes', { exact: true })).toHaveValue('')
  await expect.poll(() => storedDraft(page, 'batch')).toBeNull()
  await expect(page.getByText('Draft restored from this device.')).toHaveCount(
    0
  )
})

test('failed submit shows the summary and focuses the first invalid field', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const { requests } = await mockOperations(page)
  await gotoRoute(page, '/operations')
  await page
    .getByRole('button', { name: 'Record purchase', exact: true })
    .click()
  const summary = page.getByRole('alert').filter({
    hasText: 'Check the highlighted fields'
  })
  await expect(summary).toBeVisible()
  await expect(summary).toContainText('Supplier: This field is required.')
  await expect(page.locator('#purchase-supplier')).toBeFocused()

  // Business rule (not a field rule): repeated lot codes.
  await chooseOption(page, 'Supplier', 'Honey Cooperative')
  for (const index of [0, 1]) {
    if (index === 1)
      await page.getByRole('button', { name: 'Add line' }).click()
    await chooseOption(page, 'Material', 'Raw Honey').catch(async () => {
      await page.locator(`#purchase-line-${index}-material`).click()
      await page.getByRole('option').filter({ hasText: 'Raw Honey' }).click()
    })
    await page.locator(`#purchase-line-${index}-quantity`).fill('1')
    await page.locator(`#purchase-line-${index}-unit-cost`).fill('100')
    await page.locator(`#purchase-line-${index}-lot-code`).fill('LOT-A')
  }
  await page
    .getByRole('button', { name: 'Record purchase', exact: true })
    .click()
  await expect(summary).toContainText('Lot code "LOT-A" is repeated')
  await expect(page.locator('#purchase-line-1-lot-code')).toBeFocused()
  expect(requests.filter(r => r.key.startsWith('write'))).toHaveLength(0)
})

test('desktop purchases use a QTable with server-side paging and sorting', async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const fixtures = operationsMocks().fixtures
  const { historyRequests } = await mockOperations(page, {
    history: { purchases: makePurchases(fixtures, 23) }
  })
  await gotoRoute(page, '/operations?view=purchases', OPERATIONS)
  const table = page.locator('.q-table')
  await expect(table).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Purchases (23)' })).toBeVisible()
  await expect(table.locator('tbody tr')).toHaveCount(10)
  expect(historyRequests.at(-1)).toMatchObject({
    resource: 'purchases',
    limit: '10',
    offset: '0'
  })
  expect(historyRequests.at(-1)).not.toHaveProperty('sort')

  await table.getByRole('columnheader', { name: /Total/ }).click()
  await expect
    .poll(() => historyRequests.at(-1))
    .toMatchObject({ sort: 'total_amount', order: 'asc', offset: '0' })
  await expect(table.locator('tbody tr').first()).toContainText('UGX 1,000')

  await page.getByRole('button', { name: /next page/i }).click()
  await expect
    .poll(() => historyRequests.at(-1))
    .toMatchObject({ sort: 'total_amount', offset: '10', limit: '10' })
  await expect(table.locator('tbody tr').first()).toContainText('UGX 11,000')

  await page.getByLabel('Search purchases').fill('PUR-02')
  await expect
    .poll(() => historyRequests.at(-1))
    .toMatchObject({ q: 'PUR-02', offset: '0' })
  await expect(table.locator('tbody tr')).toHaveCount(4)
})

test('desktop selects open a menu and work from the keyboard', async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockOperations(page)
  await gotoRoute(page, '/operations')
  await page.locator('#purchase-supplier').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Supplier', { exact: true })).toHaveValue(
    /Honey Cooperative/
  )
})

test('first load is never shown as live, unavailable or zero', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockOperations(page, { delays: { 'workspace:operations': 1500 } })
  await page.goto('/#/operations')
  const chip = page.locator('.workspace-state--chip')
  await expect(chip).toHaveAttribute('data-workspace-mode', 'loading')
  await expect(page.getByText('Unavailable')).toHaveCount(0)
  await expect(page.getByText('Live data')).toHaveCount(0)
  await expect(
    page.getByRole('tab', { name: 'Purchases', exact: true })
  ).toBeVisible()
  await expect(page.getByText('Active variants')).toHaveCount(0)
  await expect(chip).toHaveAttribute('data-workspace-mode', 'live')
  await expect(page.getByRole('tab', { name: 'Purchases (1)' })).toBeVisible()

  // A refresh keeps the records on screen.
  await page.getByRole('tab', { name: 'Purchases (1)' }).click()
  await expect(page.locator('[data-row-key="1"]')).toBeVisible()
  await page.getByRole('button', { name: 'More actions' }).click()
  await page
    .getByRole('menuitem', { name: 'Refresh' })
    .or(page.locator('.q-menu .q-item').filter({ hasText: 'Refresh' }))
    .first()
    .click()
  await expect(chip).toHaveAttribute('data-workspace-mode', 'refreshing')
  await expect(page.locator('[data-row-key="1"]')).toBeVisible()
  await expect(chip).toHaveAttribute('data-workspace-mode', 'live')
})

test('overflow menu opens managers whose dialogs outlive the menu', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockOperations(page)
  await gotoRoute(page, '/operations')
  await page.getByRole('button', { name: 'More actions' }).click()
  await page
    .locator('.q-menu .q-item')
    .filter({ hasText: 'Manage materials' })
    .click()
  await expect(
    page.getByLabel('Search materials', { exact: true })
  ).toBeVisible()
  await expect(page.locator('.q-menu')).toHaveCount(0)
})

test('production staff see only production write actions', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await mockOperations(page, { role: 'production_staff' })
    await gotoRoute(page, '/operations')
    await expect(page.getByRole('tab', { name: 'Batch form' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByRole('tab', { name: 'Receipt form' })).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Record purchase' })
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'New batch' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New receipt' })).toHaveCount(
      0
    )
    for (const name of [
      'Add variant',
      'Add material',
      'Add supplier',
      'Manage suppliers'
    ])
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
        0
      )
    await page.getByRole('button', { name: 'More actions' }).click()
    await expect(
      page.locator('.q-menu .q-item').filter({ hasText: 'Refresh' })
    ).toBeVisible()
    await expect(
      page.locator('.q-menu .q-item').filter({ hasText: 'Back to dashboard' })
    ).toBeVisible()
    await expect(
      page.locator('.q-menu .q-item').filter({ hasText: 'View variants' })
    ).toBeVisible()
    await expect(
      page.locator('.q-menu .q-item').filter({ hasText: 'View materials' })
    ).toBeVisible()
    await expect(
      page
        .locator('.q-menu .q-item')
        .filter({ hasText: /Add variant|Add material|Add supplier/ })
    ).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  }
})
