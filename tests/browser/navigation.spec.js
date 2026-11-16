import { test, expect } from '@playwright/test'
import {
  DESTINATIONS,
  MAX_BOTTOM_NAV_ITEMS,
  ROLES,
  WORKSPACE_READ_ROLES,
  defaultRouteForRole,
  primaryDestinations,
  routesForRole
} from '../../src/constants/capabilities.js'

// Minimal, self-contained fixtures: navigation only needs pages to render.
const emptyWorkspace = {
  mode: 'live',
  variants: [],
  materials: [],
  suppliers: [],
  purchases: [],
  inventoryLots: [],
  batches: [],
  recipes: [],
  retailers: [],
  finishedStock: [],
  productionOutputs: [],
  stockIssues: [],
  retailerMovements: [],
  openIssueLines: [],
  reconciliations: [],
  remittances: [],
  expenses: [],
  retailerBalances: [],
  pricing: [],
  profitSummary: {
    active_retailers: 0,
    recognized_sales_value: 0,
    cost_of_goods_sold: 0,
    gross_profit: 0,
    operating_expenses: 0,
    net_profit: 0,
    outstanding_amount: 0
  }
}
const report = {
  profit: {
    revenue: 0,
    cogs: 0,
    gross_profit: 0,
    operating_expenses: 0,
    net_profit: 0
  },
  valuation: [],
  retailers: [],
  expenses: [],
  aging: [],
  digest: { materials: [], variants: [], expiring: [] },
  movements: [],
  reconciliations: [],
  costTrend: []
}

async function signInAs(page, role) {
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url())
    switch (url.pathname) {
      case '/api/auth':
        return route.fulfill({
          json: {
            user: {
              id: `test-${role}`,
              email: `${role}@example.invalid`,
              full_name: 'Navigation tester',
              role,
              is_active: true
            }
          }
        })
      case '/api/workspace': {
        // Mirror the server gate so a page never silently reads more than
        // the role is allowed to.
        const name = url.searchParams.get('name')
        if (!WORKSPACE_READ_ROLES[name]?.includes(role))
          return route.fulfill({
            status: 403,
            json: { error: 'Your role cannot perform this action.' }
          })
        return route.fulfill({ json: emptyWorkspace })
      }
      case '/api/reports':
        return route.fulfill({ json: report })
      case '/api/users':
        return route.fulfill({ json: { users: [] } })
      case '/api/materials':
        return route.fulfill({ json: { materials: [] } })
      case '/api/variants':
        return route.fulfill({ json: { variants: [], products: [] } })
      case '/api/partners':
        return route.fulfill({ json: { partners: [] } })
      default:
        return route.fulfill({ status: 404, json: {} })
    }
  })
}

const names = items => items.map(item => item.name)
const drawerItems = page =>
  page.locator('.shell-drawer [data-destination]:visible')
const bottomItems = page =>
  page.locator('.shell-bottom-nav [data-destination]:visible')
const attr = (locator, name) =>
  locator.evaluateAll((els, n) => els.map(el => el.getAttribute(n)), name)

for (const role of ROLES) {
  const allowed = routesForRole(role)
  const denied = DESTINATIONS.filter(d => !allowed.includes(d))
  const landing = defaultRouteForRole(role)

  test(`${role} at 1280px: persistent drawer matches capabilities, no bottom nav`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await signInAs(page, role)
    await page.goto(`/#${landing}`)
    await expect(page.locator('.q-page')).toBeVisible()
    await expect
      .poll(() => attr(drawerItems(page), 'data-destination'))
      .toEqual(names(allowed))
    await expect(page.locator('.shell-bottom-nav')).toHaveCount(0)

    // Selecting a destination keeps the persistent drawer open.
    const target = allowed.find(d => d.path !== landing) ?? allowed[0]
    await drawerItems(page)
      .and(page.locator(`[data-destination="${target.name}"]`))
      .click()
    await expect(page).toHaveURL(new RegExp(`#${target.path}$`))
    await expect(drawerItems(page)).toHaveCount(allowed.length)

    for (const destination of denied) {
      await page.goto(`/#${destination.path}`)
      await expect(page).toHaveURL(/#\/access-denied/)
      await expect(
        page.getByText('this workspace is restricted', { exact: false })
      ).toBeVisible()
    }
  })

  test(`${role} at 375px: bottom nav shows primary destinations, drawer shows all`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await signInAs(page, role)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/#${landing}`)
    await expect(page.locator('.q-page')).toBeVisible()

    const primary = primaryDestinations(role)
    expect(primary.length).toBeLessThanOrEqual(MAX_BOTTOM_NAV_ITEMS)
    if (primary.length === 0) {
      await expect(page.locator('.shell-bottom-nav')).toHaveCount(0)
    } else {
      await expect
        .poll(() => attr(bottomItems(page), 'data-destination'))
        .toEqual(names(primary))
      const tabs = bottomItems(page)
      // Labels match the drawer's labels and are visible.
      await expect(tabs.locator('.q-tab__label')).toHaveText(
        primary.map(item => item.label)
      )
      for (const box of await tabs.evaluateAll(els =>
        els.map(el => el.getBoundingClientRect().toJSON())
      )) {
        expect(box.height).toBeGreaterThanOrEqual(48)
        expect(box.width).toBeGreaterThanOrEqual(48)
      }
      // Exactly the current destination is marked as the current page.
      const landingName = allowed.find(d => d.path === landing)?.name
      await expect
        .poll(() => attr(tabs, 'aria-current'))
        .toEqual(
          primary.map(item => (item.name === landingName ? 'page' : null))
        )
      // Page content is padded clear of the fixed footer.
      const footerHeight = await page
        .locator('.shell-bottom-nav')
        .evaluate(el => el.getBoundingClientRect().height)
      const padding = await page
        .locator('.q-page-container')
        .evaluate(el => parseFloat(getComputedStyle(el).paddingBottom))
      expect(padding).toBeGreaterThanOrEqual(footerHeight - 1)
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
          )
        )
        .toBe(true)
    }

    // The overlay drawer lists every destination the role may open.
    await page.getByRole('button', { name: 'Toggle navigation' }).click()
    await expect
      .poll(() => attr(drawerItems(page), 'data-destination'))
      .toEqual(names(allowed))
    // Choosing a destination closes the drawer and navigates.
    const target = allowed.find(d => d.path !== landing)
    if (target) {
      await drawerItems(page)
        .and(page.locator(`[data-destination="${target.name}"]`))
        .click()
      await expect(page).toHaveURL(new RegExp(`#${target.path}$`))
      await expect(drawerItems(page)).toHaveCount(0)
      // Browser back returns to the landing page with the drawer still closed
      // and the bottom navigation in step.
      await page.goBack()
      await expect(page).toHaveURL(
        new RegExp(`#${landing === '/' ? '/?' : landing}$`)
      )
      await expect(drawerItems(page)).toHaveCount(0)
      const landingName = allowed.find(d => d.path === landing).name
      if (primary.some(item => item.name === landingName))
        await expect(
          page.locator(`.shell-bottom-nav [data-destination="${landingName}"]`)
        ).toHaveAttribute('aria-current', 'page')
    }

    for (const destination of denied) {
      await page.goto(`/#${destination.path}`)
      await expect(page).toHaveURL(/#\/access-denied/)
      await expect(
        page.getByText('this workspace is restricted', { exact: false })
      ).toBeVisible()
    }
    expect(errors).toEqual([])
  })
}

test('bottom navigation switches destination in one tap and back stays coherent', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await signInAs(page, 'operations_manager')
  await page.goto('/#/home')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  await nav.getByRole('tab', { name: 'Dashboard' }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(nav.locator('[data-destination="dashboard"]')).toHaveAttribute(
    'aria-current',
    'page'
  )
  await nav.getByRole('tab', { name: 'Operations' }).click()
  await expect(page).toHaveURL(/#\/operations$/)
  await page.goBack()
  await expect(page).toHaveURL(/#\/$/)
  await expect(nav.locator('[data-destination="dashboard"]')).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(
    nav.locator('[data-destination="operations"]')
  ).not.toHaveAttribute('aria-current', 'page')
})

test('operations manager reaches catalogue settings; owner keeps users & access', async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signInAs(page, 'operations_manager')
  await page.goto('/#/settings')
  await expect(
    page.getByRole('heading', { name: 'Catalogue settings' })
  ).toBeVisible()
  await expect(page.getByText('Set a variant price')).toBeVisible()
  await page.goto('/#/admin')
  await expect(page).toHaveURL(/#\/access-denied/)
})
