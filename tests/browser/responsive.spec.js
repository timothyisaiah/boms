// Every route fits every reference width (MF-11), plus the role matrix.
import { test, expect } from '@playwright/test'
import {
  ALL_ROUTES,
  APP_ROUTES,
  LEGACY_VIEWPORTS,
  ROLES,
  ROUTES,
  VIEWPORTS,
  canReach,
  expectNoHorizontalOverflow,
  gotoRoute,
  mockApi,
  routeTarget,
  screenshotRoute,
  trackPageErrors
} from './support/index.js'

const matrix = [
  ...VIEWPORTS.flatMap(viewport =>
    ALL_ROUTES.map(route => ({ route, viewport }))
  ),
  // Widths the original mobile.spec covered, for the original route set.
  ...LEGACY_VIEWPORTS.flatMap(viewport =>
    APP_ROUTES.map(route => ({ route, viewport }))
  )
]

for (const { route, viewport } of matrix)
  test(`${route.name} fits at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await mockApi(page, { role: route.roles === null ? null : 'admin_owner' })
    const errors = trackPageErrors(page)
    await gotoRoute(page, route.path, routeTarget(route))
    await screenshotRoute(page, route.name, viewport.width)
    if (route.heading)
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: route.heading,
          exact: typeof route.heading === 'string'
        })
      ).toBeVisible()
    await expectNoHorizontalOverflow(page)
    expect(errors).toEqual([])
  })

for (const role of ROLES)
  test(`${role} reaches only permitted routes at 320px`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS[0])
    await mockApi(page, { role })
    const errors = trackPageErrors(page)
    for (const route of APP_ROUTES) {
      const allowed = canReach(route, role)
      const destination = allowed ? route : ROUTES.accessDenied
      await gotoRoute(page, route.path, {
        ...routeTarget(destination),
        expectPath: destination.path
      })
      await expectNoHorizontalOverflow(page)
    }
    expect(errors).toEqual([])
  })
