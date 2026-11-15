// Operations workspace (/operations): receipts and production batches.
import { test, expect } from '@playwright/test'
import { chooseOption, gotoRoute, mockApi } from './support/index.js'

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
