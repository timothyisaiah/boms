// Accessibility smoke checks per route. Routes that currently fail are
// test.fixme with the defect noted; page agents remove the entry when fixed
// (and give routes without an h1 a `heading` in support/routes.js).
import { test, expect } from '@playwright/test'
import {
  ALL_ROUTES,
  emulateReducedMotion,
  expectNoHorizontalOverflow,
  expectNoSkippedHeadingLevels,
  expectSingleH1,
  gotoRoute,
  mockApi,
  routeTarget
} from './support/index.js'

const PHONE = { width: 375, height: 812 }
const DESKTOP = { width: 1440, height: 900 }

// `<route>@<phone|desktop>` → why the heading checks currently fail.
const KNOWN_HEADING_DEFECTS = {}

for (const [size, viewport] of Object.entries({
  phone: PHONE,
  desktop: DESKTOP
}))
  for (const route of ALL_ROUTES)
    test(`${route.name} heading outline on ${size}`, async ({ page }) => {
      const defect = KNOWN_HEADING_DEFECTS[`${route.name}@${size}`]
      test.fixme(Boolean(defect), defect)
      await page.setViewportSize(viewport)
      await mockApi(page, { role: route.roles === null ? null : 'admin_owner' })
      await gotoRoute(page, route.path, routeTarget(route))
      await expectSingleH1(page)
      await expectNoSkippedHeadingLevels(page)
    })

test('reduced-motion emulation example', async ({ page }) => {
  await emulateReducedMotion(page)
  await page.setViewportSize(PHONE)
  await mockApi(page)
  await gotoRoute(page, '/operations')
  expect(
    await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  ).toBe(true)
  // Pages agents can extend this: e.g. assert that animated elements resolve
  // to `animation-duration`/`transition-duration` of ~0s under reduce.
  await expectSingleH1(page)
})

test('auth keeps its semantic page heading visible at 320px', async ({
  page
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await mockApi(page, { role: null })
  await gotoRoute(page, '/auth')

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /^Trace every batch with the right people/
    })
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('settings managers survive the header menu closing at 430px', async ({
  page
}) => {
  await page.setViewportSize({ width: 430, height: 844 })
  await mockApi(page)
  await gotoRoute(page, '/settings')
  await expectNoHorizontalOverflow(page)

  await page.getByRole('button', { name: 'Catalogue actions' }).click()
  await page.getByText('Manage variants', { exact: true }).click()
  await expect(
    page.getByRole('dialog').getByRole('heading', {
      level: 2,
      name: 'Manage variants'
    })
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: 'Close variant manager' }).click()

  await page.getByRole('button', { name: 'Catalogue actions' }).click()
  await page.getByText('Manage materials', { exact: true }).click()
  await expect(
    page.getByRole('dialog').getByRole('heading', {
      level: 2,
      name: 'Manage materials'
    })
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
