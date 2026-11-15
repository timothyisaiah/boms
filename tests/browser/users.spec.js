import { test, expect } from '@playwright/test'
import { expectNoHorizontalOverflow, serveLocalFonts } from './support/index.js'

for (const width of [375, 1280])
  test(`administrator creates and manages users at ${width}px`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await serveLocalFonts(page)
    const admin = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'admin@example.invalid',
      full_name: 'Test administrator',
      role: 'admin_owner',
      is_active: true
    }
    const users = [admin]
    const submitted = []
    await page.route('**/api/**', async route => {
      const request = route.request(),
        url = new URL(request.url())
      if (url.pathname === '/api/auth')
        return route.fulfill({ json: { user: admin } })
      if (url.pathname === '/api/workspace')
        return route.fulfill({
          json: { variants: [], materials: [], recipes: [], pricing: [] }
        })
      if (url.pathname === '/api/users') {
        if (request.method() === 'GET')
          return route.fulfill({ json: { users } })
        const body = request.postDataJSON()
        submitted.push(body)
        if (request.method() === 'POST')
          users.push({
            id: '00000000-0000-4000-8000-000000000002',
            full_name: body.fullName,
            email: body.email,
            role: body.role,
            is_active: body.isActive
          })
        else
          Object.assign(
            users.find(user => user.id === body.id),
            {
              full_name: body.fullName,
              role: body.role,
              is_active: body.isActive
            }
          )
        return route.fulfill({
          status: request.method() === 'POST' ? 201 : 200,
          json: { id: users.at(-1).id }
        })
      }
      return route.fulfill({ status: 404 })
    })
    await page.goto('/#/admin')
    await expect(
      page.getByRole('heading', { name: 'Users and access' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Add user', exact: true }).click()
    await page.getByRole('button', { name: 'Create user', exact: true }).click()
    await expect(
      page.getByText('This field is required.').first()
    ).toBeVisible()
    expect(submitted).toHaveLength(0)
    await page.getByLabel('Full name', { exact: true }).fill('New colleague')
    await page
      .getByLabel('Email address', { exact: true })
      .fill('colleague@example.invalid')
    await page.getByLabel('User role', { exact: true }).click()
    await page
      .getByRole('option')
      .filter({ hasText: 'Warehouse Staff' })
      .click()
    await page
      .getByLabel('Initial password', { exact: true })
      .fill('test-only-password-123')
    await page.getByRole('button', { name: 'Create user', exact: true }).click()
    await expect(
      page.getByText(
        'User created. They can sign in with the assigned credentials.'
      )
    ).toBeVisible()
    expect(submitted[0].role).toBe('warehouse_staff')
    await page
      .getByRole('button', { name: 'Edit access for New colleague' })
      .click()
    await page.getByLabel('User role', { exact: true }).click()
    await page
      .getByRole('option')
      .filter({ hasText: 'Finance / Accountant' })
      .click()
    await page.getByRole('switch', { name: 'Account active' }).click()
    await page.getByRole('button', { name: 'Save access', exact: true }).click()
    await expect(
      page.getByText('User access saved.', { exact: true })
    ).toBeVisible()
    expect(submitted[1]).toMatchObject({
      role: 'finance_accountant',
      isActive: false
    })
    expect(submitted[1]).not.toHaveProperty('password')
    await expect(page.getByText('Inactive', { exact: true })).toBeVisible()
    await page.getByLabel('Search users by name or email').fill('colleague')
    await expect(page.locator('.user-card')).toHaveCount(1)
    await expectNoHorizontalOverflow(page)
    await page.screenshot({
      path: `test-results/${width}-users.png`,
      fullPage: true
    })
  })
