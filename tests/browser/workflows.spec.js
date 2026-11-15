// Cross-module journeys that span several workspaces.
import { test, expect } from '@playwright/test'
import { validateAction } from '../../server/validation.ts'
import { chooseOption, gotoRoute, mockApi } from './support/index.js'

test('all six phone forms send payloads accepted by the API schema', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 844 })
  await mockApi(page)
  const posted = []
  await page.route('**/api/write?*', async route => {
    const action = new URL(route.request().url()).searchParams.get('action')
    validateAction(action, route.request().postDataJSON())
    posted.push(action)
    await route.fulfill({ status: 201, json: { id: 123 } })
  })
  const choose = (label, text) => chooseOption(page, label, text)
  await gotoRoute(page, '/operations')
  await page.getByRole('tab', { name: 'Receipt form' }).click()
  await choose('Supplier', 'Honey Cooperative')
  await choose('Material', 'Raw Honey')
  await page.getByLabel('Quantity', { exact: true }).fill('10')
  await page.getByLabel('Unit cost (UGX)', { exact: true }).fill('10000')
  await page
    .getByRole('button', { name: 'Record purchase', exact: true })
    .click()
  await expect.poll(() => posted.length).toBe(1)
  await page.getByRole('tab', { name: 'Batch form' }).click()
  await choose('Finished variant', '500g Classic Jar')
  await page.getByLabel('Jars produced', { exact: true }).fill('20')
  await page
    .getByRole('button', { name: 'Create production batch', exact: true })
    .click()
  await expect.poll(() => posted.length).toBe(2)
  await gotoRoute(page, '/retail')
  await page.getByRole('tab', { name: 'Issue stock', exact: true }).click()
  await choose('Retail partner', 'Ntinda')
  await choose('Finished batch', 'PB-20260910')
  await page.getByLabel('Jars issued', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Issue stock', exact: true }).click()
  await expect.poll(() => posted.length).toBe(3)
  await gotoRoute(page, '/finance')
  await page.getByRole('tab', { name: 'Reconciliation', exact: true }).click()
  await choose('Retail partner', 'Ntinda')
  await choose('Issued stock line', 'DN-001')
  await page.getByLabel('Sold', { exact: true }).fill('5')
  await page.getByLabel('Returned', { exact: true }).fill('1')
  await page.getByLabel('Damaged', { exact: true }).fill('1')
  await page.getByLabel('Expired', { exact: true }).fill('1')
  await page.getByLabel('Remaining', { exact: true }).fill('2')
  await page.getByLabel('Return / loss reason').fill('Shelf check')
  await page
    .getByRole('button', { name: 'Record reconciliation', exact: true })
    .click()
  await expect.poll(() => posted.length).toBe(4)
  await page.getByRole('tab', { name: 'Remittance', exact: true }).click()
  await choose('Retail partner', 'Ntinda')
  await choose('Linked reconciliation', 'REC-001')
  await page.getByLabel('Amount remitted', { exact: true }).fill('10000')
  await page
    .getByRole('button', { name: 'Record remittance', exact: true })
    .click()
  await expect.poll(() => posted.length).toBe(5)
  await page.getByRole('tab', { name: 'Expense', exact: true }).click()
  await page.getByLabel('Expense category', { exact: true }).fill('Transport')
  await page.getByLabel('Expense amount', { exact: true }).fill('10000')
  await page
    .getByRole('button', { name: 'Record expense', exact: true })
    .click()
  await expect.poll(() => posted.length).toBe(6)
  expect(posted).toEqual([
    'purchases',
    'production',
    'stock-issues',
    'reconciliations',
    'remittances',
    'expenses'
  ])
})
