// Finance workspace (/finance): reconciliation, remittance, expenses.
import { test, expect } from '@playwright/test'
import { gotoRoute, mockApi } from './support/index.js'

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
