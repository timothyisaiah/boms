// One-tap home (/home): make jars, stock in, give, sell, check in, scanning.
import { test, expect } from '@playwright/test'
import {
  expectNoHorizontalOverflow,
  gotoRoute,
  mockApi
} from './support/index.js'

const PHONE = { width: 375, height: 812 }
const SMALL_PHONE = { width: 320, height: 568 }

const writes = (requests, action) =>
  requests
    .filter(r => r.key === `write:${action}`)
    .map(r => ({ ...r, body: JSON.parse(r.body) }))
const action = (page, key) => page.locator(`[data-home-action="${key}"]`)
const dialog = page => page.locator('.flow-dialog')
const row = (page, sku) => dialog(page).locator(`[data-variant="${sku}"]`)
const submit = page => dialog(page).locator('[data-flow-submit]')

test('home shows big actions and jar counts on a phone', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await mockApi(page)
  await gotoRoute(page, '/home')
  for (const key of ['make', 'give', 'sell', 'checkin', 'stock-in'])
    await expect(action(page, key)).toBeVisible()
  await expect(
    page.getByText('Raw Honey', { exact: true }).first()
  ).toBeVisible()
  await expect(page.locator('.home-jar').first()).toContainText('120')
  await expect(page.getByText('30 kg (1.5 jerricans)')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: 'test-results/home-375.png', fullPage: true })
})

test('make jars: shows what will be used, blocks shortages, one tap saves', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  const { requests } = await mockApi(page)
  await gotoRoute(page, '/home')
  await action(page, 'make').click()
  await row(page, 'BEE-RAW-60').locator('input').fill('100')
  const uses = dialog(page).locator('[data-make-uses]')
  await expect(uses).toContainText('6 kg (0.3 jerricans)')
  await expect(submit(page)).toHaveText(/Make 100 jars/)

  // 30 ginger jars need 30 x 400g jars but only 10 are in stock.
  await row(page, 'BEE-GIN-400').locator('input').fill('30')
  await expect(uses).toContainText('only 10 pieces in stock')
  await expect(submit(page)).toBeDisabled()
  await page.screenshot({ path: 'test-results/home-make-short.png' })

  await row(page, 'BEE-GIN-400').locator('input').fill('5')
  await expect(uses).toContainText('Ginger Powder')
  await submit(page).click()
  await expect(dialog(page)).toContainText('105 jars made')
  const [request] = writes(requests, 'production-run')
  expect(request.body.items).toEqual([
    { variant_id: 11, quantity: 100 },
    { variant_id: 13, quantity: 5 }
  ])
})

test('sell: scanning a jar barcode adds it, price is preset', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  const { requests } = await mockApi(page)
  await gotoRoute(page, '/home')
  await action(page, 'sell').click()
  const scan = dialog(page).locator('input[data-scan-input]')
  for (let n = 0; n < 2; n++) {
    await scan.fill('6151100000601')
    await scan.press('Enter')
  }
  await expect(row(page, 'BEE-RAW-60').locator('input')).toHaveValue('2')
  await expect(dialog(page)).toContainText('Raw Honey 60g — 2 in this list')
  await dialog(page).getByRole('button', { name: 'Mobile money' }).click()
  await expect(submit(page)).toHaveText(/Sold — UGX\s?10,000/)
  await page.screenshot({ path: 'test-results/home-sell.png' })
  await submit(page).click()
  await expect(dialog(page)).toContainText('Sale recorded')
  const [request] = writes(requests, 'direct-sales')
  expect(request.body.paymentMethod).toBe('mobile_money')
  expect(request.body.items).toEqual([{ variant_id: 11, quantity: 2 }])
})

test('an unknown barcode can be linked to a product once', async ({ page }) => {
  await page.setViewportSize(PHONE)
  const { requests } = await mockApi(page)
  await gotoRoute(page, '/home')
  await action(page, 'give').click()
  // The only retailer is chosen automatically.
  await expect(dialog(page)).toContainText('To Ntinda Health Market')
  const scan = dialog(page).locator('input[data-scan-input]')
  await scan.fill('6151100004004')
  await scan.press('Enter')
  const link = page.locator('.link-barcode')
  await expect(link).toContainText('New barcode 6151100004004')
  await link.getByRole('button', { name: /Raw Honey 400g/ }).click()
  await link.getByRole('button', { name: 'Link barcode' }).click()
  await expect(link).toBeHidden()
  expect(writes(requests, 'variant-barcode')[0].body).toEqual({
    variantId: 12,
    barcode: '6151100004004'
  })
  await expect(row(page, 'BEE-RAW-400').locator('input')).toHaveValue('1')
  // Linked now: the next scan of the same code counts straight away.
  await scan.fill('6151100004004')
  await scan.press('Enter')
  await expect(row(page, 'BEE-RAW-400').locator('input')).toHaveValue('2')
  await submit(page).click()
  await expect(dialog(page)).toContainText(
    '2 jars given to Ntinda Health Market'
  )
  expect(writes(requests, 'stock-issues')[0].body).toMatchObject({
    retailerId: 1,
    items: [{ variant_id: 12, quantity: 2 }]
  })
})

test('check-in: shelf count works out sales, money collected and balance', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  const { requests } = await mockApi(page)
  await gotoRoute(page, '/home')
  await action(page, 'checkin').click()
  // The only retailer holding jars is chosen automatically.
  await expect(dialog(page)).toContainText('Ntinda Health Market')
  await row(page, 'BEE-RAW-60').locator('input').fill('10')
  await expect(dialog(page)).toContainText(/20 jars · UGX\s?100,000/)
  await dialog(page).locator('input[data-checkin-collected]').fill('50000')
  await expect(dialog(page)).toContainText(/They will still owe\s*UGX\s?70,000/)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/home-checkin.png' })
  await submit(page).click()
  await expect(dialog(page)).toContainText('Ntinda Health Market checked in')
  expect(writes(requests, 'retailer-checkins')[0].body).toMatchObject({
    retailerId: 1,
    counts: [{ variant_id: 11, remaining: 10, damaged: 0 }],
    amount: '50000'
  })
})

test('stock in: jerricans convert to kilograms and cost per kg', async ({
  page
}) => {
  await page.setViewportSize(PHONE)
  const { requests } = await mockApi(page)
  await gotoRoute(page, '/home')
  await action(page, 'stock-in').click()
  const honey = dialog(page).locator('[data-material="RAW-HONEY-KG"]')
  await honey.getByLabel(/How many jerricans/).fill('2')
  await expect(submit(page)).toBeDisabled()
  await honey.getByLabel('Total paid (UGX)').fill('400000')
  await submit(page).click()
  await expect(dialog(page)).toContainText('Supplies stocked in')
  const [request] = writes(requests, 'purchases')
  expect(request.body.supplierId).toBe(1)
  expect(request.body.items).toEqual([
    {
      material_id: 21,
      quantity: '40.000',
      unit_cost: '10000.00',
      lot_code: null
    }
  ])
})

test('sales staff see only the actions they may do', async ({ page }) => {
  await page.setViewportSize(SMALL_PHONE)
  await mockApi(page, { role: 'sales_or_distribution_staff' })
  await gotoRoute(page, '/home')
  await expect(action(page, 'give')).toBeVisible()
  await expect(action(page, 'sell')).toBeVisible()
  await expect(action(page, 'make')).toHaveCount(0)
  await expect(action(page, 'checkin')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})
