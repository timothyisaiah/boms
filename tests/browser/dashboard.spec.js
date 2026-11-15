// Dashboard (/): business review and reports.
import { test, expect } from '@playwright/test'
import { gotoRoute, mockApi } from './support/index.js'

test('weekly reports use cards on phones and tables on desktop', async ({
  page
}) => {
  await mockApi(page)
  await page.setViewportSize({ width: 375, height: 844 })
  await gotoRoute(page, '/')
  await page.getByRole('button', { name: 'Weekly', exact: true }).click()
  await page.getByText('Stock movement', { exact: true }).click()
  await expect(page.locator('.report-cards:visible').first()).toBeVisible()
  await expect(page.locator('.q-table')).toHaveCount(0)
  await page.setViewportSize({ width: 1280, height: 844 })
  await expect(page.locator('.q-table:visible').first()).toBeVisible()
  await page
    .getByRole('button', { name: 'Monthly review', exact: true })
    .click()
  await page.getByText('Inventory at month end', { exact: true }).click()
  await expect(page.getByText('Raw honey', { exact: true })).toBeVisible()
})
