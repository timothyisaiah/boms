// Iteration 3 (critical form recovery) for operations and retail: the
// receipt draft, and the post-save confirmation with next actions on the
// receipt, batch and stock-issue forms.
import { test, expect } from '@playwright/test'
import { chooseOption, gotoRoute } from './support/index.js'
import { operationsMocks } from './support/operations-mocks.js'
import { mockRetailApi } from './support/retail-mocks.js'
import { mockApi } from './support/fixtures.js'

const PHONE = { width: 375, height: 812 }
const OPERATIONS = { expectPath: '/operations' }
const RECEIPT_DRAFT = 'boms:draft:test:operations:receipt'
const readDraft = (page, key = RECEIPT_DRAFT) =>
  page.evaluate(storageKey => sessionStorage.getItem(storageKey), key)
const confirmation = page => page.locator('[data-save-confirmation]')

async function mockOperations(page) {
  const mocks = operationsMocks()
  return mockApi(page, { fixtures: mocks.fixtures, overrides: mocks.overrides })
}

/** Record every write body; `fail` decides which attempts abort. */
async function captureWrites(page, { fail = () => false } = {}) {
  const writes = []
  await page.route('**/api/write?*', async route => {
    writes.push({
      action: new URL(route.request().url()).searchParams.get('action'),
      key: route.request().headers()['idempotency-key'],
      body: route.request().postDataJSON()
    })
    if (fail(writes.length)) await route.abort('failed')
    else await route.fulfill({ status: 201, json: { id: 90 + writes.length } })
  })
  return writes
}

async function fillReceipt(page, { reference = 'INV-DRAFT-1' } = {}) {
  await chooseOption(page, 'Supplier', 'Honey Cooperative')
  await chooseOption(page, 'Material', 'Raw Honey')
  await page.getByLabel('Quantity', { exact: true }).fill('12')
  await page.getByLabel('Unit cost (UGX)', { exact: true }).fill('9000')
  await page.getByLabel('Reference', { exact: true }).fill(reference)
}

const recordPurchase = page =>
  page.getByRole('button', { name: 'Record purchase', exact: true }).click()

test('receipt draft survives reload and a route round-trip, then clears on save', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  page.on('dialog', dialog => dialog.accept())
  await mockOperations(page)
  const writes = await captureWrites(page)
  await gotoRoute(page, '/operations?view=receipt-entry', OPERATIONS)
  await fillReceipt(page)
  await expect.poll(() => readDraft(page)).toContain('INV-DRAFT-1')
  const stored = JSON.parse(await readDraft(page))
  expect(stored.identity).toBe('test')
  expect(Object.keys(stored.data).sort()).toEqual([
    'items',
    'notes',
    'purchaseReference',
    'purchasedOn',
    'supplierId'
  ])
  expect(JSON.stringify(stored)).not.toMatch(/idempotency/i)

  await page.reload()
  await expect(page.getByText('Draft restored from this device.')).toBeVisible()
  await expect(page.getByLabel('Reference', { exact: true })).toHaveValue(
    'INV-DRAFT-1'
  )
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('12')

  // Leaving the route asks first; the draft is kept for the way back.
  await page.evaluate(() => {
    location.hash = '#/'
  })
  const guard = page.getByRole('alertdialog', { name: 'Leave this form?' })
  await expect(guard).toBeVisible()
  await guard.getByRole('button', { name: 'Leave' }).click()
  await expect(page).toHaveURL(/#\/$/)
  // In-app navigation back: the cached workspace may not be re-requested.
  await gotoRoute(page, '/operations?view=receipt-entry', {
    ...OPERATIONS,
    workspace: null
  })
  await expect(page.getByText('Draft restored from this device.')).toBeVisible()
  await expect(page.getByLabel('Reference', { exact: true })).toHaveValue(
    'INV-DRAFT-1'
  )
  await expect(page.getByLabel('Supplier', { exact: true })).toHaveValue(
    /Honey Cooperative/
  )

  await recordPurchase(page)
  await expect(confirmation(page)).toContainText(
    'Receipt recorded from Honey Cooperative'
  )
  await expect(confirmation(page)).toBeFocused()
  expect(writes).toHaveLength(1)
  expect(writes[0].action).toBe('purchases')
  expect(writes[0].body).toMatchObject({
    supplierId: 1,
    purchaseReference: 'INV-DRAFT-1',
    items: [{ material_id: 1, quantity: 12, unit_cost: 9000, lot_code: null }]
  })
  await expect.poll(() => readDraft(page)).toBeNull()
  await expect(page.getByText('Draft restored from this device.')).toHaveCount(
    0
  )
  await expect(page.getByLabel('Reference', { exact: true })).toHaveValue('')
})

test('an uncertain receipt write keeps the draft until the retry is confirmed', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  page.on('dialog', dialog => dialog.accept())
  await mockOperations(page)
  const writes = await captureWrites(page, { fail: attempt => attempt === 1 })
  await gotoRoute(page, '/operations?view=receipt-entry', OPERATIONS)
  await fillReceipt(page, { reference: 'INV-UNCERTAIN' })
  await expect.poll(() => readDraft(page)).toContain('INV-UNCERTAIN')

  await recordPurchase(page)
  await expect(
    page.getByRole('button', { name: 'Retry saved submission' })
  ).toBeVisible()
  await expect(confirmation(page)).toHaveCount(0)
  expect(await readDraft(page)).toContain('INV-UNCERTAIN')
  await expect(page.getByLabel('Reference', { exact: true })).toHaveValue(
    'INV-UNCERTAIN'
  )

  await page.getByRole('button', { name: 'Retry saved submission' }).click()
  await expect(confirmation(page)).toContainText('Saved receipt confirmed')
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  await expect.poll(() => readDraft(page)).toBeNull()
})

test('receipt confirmation: another receipt resets the form, next actions change the view', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  page.on('dialog', dialog => dialog.accept())
  await mockOperations(page)
  await captureWrites(page)
  await gotoRoute(page, '/operations?view=receipt-entry', OPERATIONS)
  await fillReceipt(page)
  await recordPurchase(page)
  const panel = confirmation(page)
  await expect(panel).toBeVisible()
  await expect(panel).toHaveAttribute('role', 'status')

  await panel.getByRole('button', { name: 'Record another receipt' }).click()
  await expect(confirmation(page)).toHaveCount(0)
  await expect(page.locator('#purchase-supplier')).toBeFocused()
  await expect(page.getByLabel('Reference', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('')

  await fillReceipt(page, { reference: 'INV-SECOND' })
  await recordPurchase(page)
  await confirmation(page)
    .getByRole('button', { name: 'View purchases' })
    .click()
  await expect(page).toHaveURL(/view=purchases/)
  await expect(page.getByRole('tab', { name: /^Purchases/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )

  // Coming back to the form, the confirmation has been dismissed.
  await page.getByRole('tab', { name: 'Receipt form' }).click()
  await expect(confirmation(page)).toHaveCount(0)
  await fillReceipt(page, { reference: 'INV-THIRD' })
  await recordPurchase(page)
  await confirmation(page)
    .getByRole('button', { name: 'Create a batch' })
    .click()
  await expect(page).toHaveURL(/view=batch-entry/)
  await expect(page.locator('#batch-variant')).toBeFocused()
})

test('batch confirmation: another batch resets the form, view batches changes the view', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  page.on('dialog', dialog => dialog.accept())
  await mockOperations(page)
  const writes = await captureWrites(page)
  await gotoRoute(page, '/operations?view=batch-entry', OPERATIONS)
  const code = await page.getByLabel('Batch code', { exact: true }).inputValue()
  await chooseOption(page, 'Finished variant', '500g Classic Jar')
  await page.getByLabel('Jars produced', { exact: true }).fill('20')
  await page.getByLabel('Batch notes', { exact: true }).fill('Morning run')
  const create = () =>
    page
      .getByRole('button', { name: 'Create production batch', exact: true })
      .click()
  await create()

  const panel = confirmation(page)
  await expect(panel).toContainText(`Batch ${code} created`)
  await expect(panel).toContainText('20 jars of')
  await expect(panel).toBeFocused()
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toMatchObject({
    variantId: 1,
    batchCode: code,
    outputQuantity: 20,
    notes: 'Morning run'
  })

  await panel.getByRole('button', { name: 'Create another batch' }).click()
  await expect(confirmation(page)).toHaveCount(0)
  await expect(page.locator('#batch-variant')).toBeFocused()
  await expect(page.getByLabel('Batch notes', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Jars produced', { exact: true })).toHaveValue(
    ''
  )

  await chooseOption(page, 'Finished variant', '500g Classic Jar')
  await page.getByLabel('Jars produced', { exact: true }).fill('10')
  await create()
  await expect.poll(() => writes.length).toBe(2)
  await confirmation(page).getByRole('button', { name: 'View batches' }).click()
  await expect(page).toHaveURL(/view=batches/)
  await expect(page.getByRole('tab', { name: /^Batches/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )
})

test('stock-issue confirmation: issue more resets the form, view dispatches changes the view', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  page.on('dialog', dialog => dialog.accept())
  await mockRetailApi(page)
  const writes = await captureWrites(page)
  await gotoRoute(page, '/retail')

  async function issue(reference) {
    await chooseOption(page, 'Retail partner', 'Ntinda')
    await chooseOption(page, 'Finished batch', 'PB-20260910')
    await page.getByLabel('Jars issued', { exact: true }).fill('4')
    await page.getByLabel('Dispatch reference', { exact: true }).fill(reference)
    await page.getByRole('button', { name: 'Issue stock', exact: true }).click()
  }

  await issue('VAN-1')
  const panel = confirmation(page)
  await expect(panel).toContainText('4 jars issued to Ntinda Health Market')
  await expect(panel).toContainText('Dispatch reference VAN-1.')
  await expect(panel).toBeFocused()
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toEqual({
    retailerId: 1,
    issuedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/),
    issueReference: 'VAN-1',
    notes: '',
    items: [{ production_output_id: 1, quantity: 4 }]
  })

  await panel.getByRole('button', { name: 'Issue more stock' }).click()
  await expect(confirmation(page)).toHaveCount(0)
  await expect(page.locator('#stock-issue-retailer')).toBeFocused()
  await expect(
    page.getByLabel('Dispatch reference', { exact: true })
  ).toHaveValue('')
  await expect(page.getByLabel('Jars issued', { exact: true })).toHaveValue('')

  await issue('VAN-2')
  await expect.poll(() => writes.length).toBe(2)
  await confirmation(page)
    .getByRole('button', { name: 'View dispatches' })
    .click()
  await expect(page).toHaveURL(/view=dispatches/)
  await expect(
    page.getByRole('heading', { level: 2, name: 'Dispatch records' })
  ).toBeVisible()
})
