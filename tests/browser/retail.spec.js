// Distribution workspace (/retail): stock issues to retail partners.
import { test, expect } from '@playwright/test'
import { gotoRoute, mockApi } from './support/index.js'

test('issue stock form lists live finished batches on a phone', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockApi(page)
  await gotoRoute(page, '/retail')
  await page.getByRole('tab', { name: 'Issue stock', exact: true }).click()
  await page.getByLabel('Finished batch', { exact: true }).click()
  await expect(
    page.getByRole('option').filter({ hasText: 'PB-20260910' })
  ).toBeVisible()
})
