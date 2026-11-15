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

// Known horizontal-overflow defects, keyed `<route>@<width>`. Each case runs
// as an expected failure (test.fail) so the suite stays green today and
// flips to "unexpectedly passed" the moment the defect is fixed — delete the
// entry then.
const KNOWN_OVERFLOW = {
  // MF-01: .dashboard-hero__controls / .dashboard-view-toggle extend past a
  // 320px viewport (document ≈331px wide).
  'dashboard@320': 'MF-01 dashboard view toggle overflows at 320px'
}

// Routes whose h1 is missing or hidden at some widths. The fits test then
// waits for `ready` text instead (overflow is still checked) and records an
// annotation; a11y.spec.js tracks the heading defect itself as test.fixme.
const KNOWN_HEADING_GAPS = {
  // The auth h1 sits in .auth-hero, which is display:none below 1024px, so
  // phones and tablets get no visible h1 at all.
  auth: {
    applies: width => width < 1024,
    ready: 'Access your Beecone workspace',
    note: 'auth h1 hidden below 1024px (.auth-hero display:none)'
  }
}

// PW_SHOW_KNOWN=1 runs known defects as ordinary tests so their failure
// output (including overflow offenders) is printed.
const showKnown = process.env.PW_SHOW_KNOWN === '1'

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
    const known = KNOWN_OVERFLOW[`${route.name}@${viewport.width}`]
    test.fail(Boolean(known) && !showKnown, known)
    const gap = KNOWN_HEADING_GAPS[route.name]
    const headingGap = !showKnown && gap?.applies(viewport.width)
    if (headingGap)
      test
        .info()
        .annotations.push({ type: 'heading-gap', description: gap.note })
    await page.setViewportSize(viewport)
    await mockApi(page, { role: route.roles === null ? null : 'admin_owner' })
    const errors = trackPageErrors(page)
    await gotoRoute(
      page,
      route.path,
      headingGap
        ? { ...routeTarget(route), heading: null, ready: gap.ready }
        : routeTarget(route)
    )
    await screenshotRoute(page, route.name, viewport.width)
    if (route.heading && !headingGap)
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
      const known = !showKnown && KNOWN_OVERFLOW[`${destination.name}@320`]
      // Overflow on known-defect routes is covered by the matrix above.
      if (!known) await expectNoHorizontalOverflow(page)
    }
    expect(errors).toEqual([])
  })
