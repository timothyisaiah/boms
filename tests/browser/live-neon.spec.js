import { test, expect } from '@playwright/test'
import { loadEnv } from '../../scripts/env.mjs'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })
test('real browser signs in through the local API and reads Neon workspaces', async ({
  page
}) => {
  test.skip(
    process.env.BOMS_LIVE_UI !== '1',
    'Opt-in: requires the local API and provisioned administrator.'
  )
  test.setTimeout(90000)
  loadEnv()
  const email = process.env.BOMS_ADMIN_EMAIL
  const password = process.env.BOMS_ADMIN_PASSWORD
  if (!email || !password)
    throw new Error(
      'Configure the provisioned administrator in a local environment file.'
    )
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/auth')
  try {
    await page.getByLabel('Work email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    const login = page.waitForResponse(response =>
      response.url().includes('/api/auth?action=login')
    )
    await page
      .getByRole('button', { name: 'Sign in to BOMS', exact: true })
      .click()
    expect((await login).status()).toBe(200)
    await expect(page).not.toHaveURL(/#\/auth/)
    for (const name of ['operations', 'retail', 'finance', 'admin']) {
      const userList =
        name === 'admin'
          ? page.waitForResponse(response =>
              response.url().includes('/api/users')
            )
          : null
      const loaded = page.waitForResponse(response =>
        response.url().includes('/api/workspace?')
      )
      await page.goto(`/#/${name}`)
      expect((await loaded).status()).toBe(200)
      if (name === 'operations') {
        const variants = page.waitForResponse(
          response => new URL(response.url()).pathname === '/api/variants'
        )
        await page
          .getByRole('button', { name: 'Manage variants', exact: true })
          .click()
        expect((await variants).status()).toBe(200)
        await expect(
          page.getByLabel('Search variants', { exact: true })
        ).toBeVisible()
        await page
          .getByRole('button', { name: 'Close variant manager' })
          .click()
        const materials = page.waitForResponse(
          response => new URL(response.url()).pathname === '/api/materials'
        )
        await page
          .getByRole('button', { name: 'Manage materials', exact: true })
          .click()
        expect((await materials).status()).toBe(200)
        await expect(
          page.getByLabel('Search materials', { exact: true })
        ).toBeVisible()
        await page
          .getByRole('button', { name: 'Close material manager' })
          .click()
      }
      if (name === 'operations' || name === 'retail') {
        const kind = name === 'operations' ? 'supplier' : 'retailer'
        await expect(
          page.getByRole('button', { name: `Add ${kind}`, exact: true })
        ).toBeVisible()
        const profiles = page.waitForResponse(response =>
          response.url().includes(`/api/partners?kind=${kind}`)
        )
        await page
          .getByRole('button', { name: `Manage ${kind}s`, exact: true })
          .click()
        expect((await profiles).status()).toBe(200)
        await expect(
          page.getByLabel(`Search ${kind}s`, { exact: true })
        ).toBeVisible()
        await page
          .getByRole('button', { name: `Close ${kind} profiles` })
          .click()
      }
      if (userList) {
        expect((await userList).status()).toBe(200)
        await expect(
          page.getByRole('button', { name: 'Add user', exact: true })
        ).toBeVisible()
      }
      await expect(page.locator('.q-page')).toBeVisible()
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          )
        )
        .toBe(true)
    }
    expect(errors).toEqual([])
  } finally {
    await page.request
      .post('/api/auth?action=logout', {
        headers: { Origin: 'http://localhost:9000' }
      })
      .catch(() => {})
  }
})
