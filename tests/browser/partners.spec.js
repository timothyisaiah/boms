import { test, expect } from '@playwright/test'
import { validateAction } from '../../server/validation.ts'

async function openHeaderAction(page, label) {
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.locator('.q-menu .q-item').filter({ hasText: label }).click()
}

for (const width of [375, 1280])
  test(`add suppliers and retailers and select them at ${width}px`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 844 })
    const suppliers = [],
      retailers = [],
      requests = [],
      profileUpdates = []
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', async route => {
      const request = route.request(),
        url = new URL(request.url())
      if (url.pathname === '/api/auth')
        return route.fulfill({
          json: {
            user: {
              id: 'partner-test',
              role: 'admin_owner',
              is_active: true,
              email: 'admin@example.invalid'
            }
          }
        })
      if (url.pathname === '/api/workspace')
        return route.fulfill({
          json: {
            mode: 'live',
            suppliers: suppliers.filter(partner => partner.is_active !== false),
            retailers: retailers.filter(partner => partner.is_active !== false),
            variants: [],
            materials: [],
            inventoryLots: [],
            batches: [],
            recipes: [],
            purchases: [],
            finishedStock: [
              {
                id: 1,
                quantity_remaining: 20,
                quantity_produced: 20,
                unit_cost: 5000,
                variant: {
                  id: 1,
                  sku: 'H-500',
                  variant_name: '500g honey',
                  pack_size_grams: 500
                },
                batch: {
                  id: 1,
                  batch_code: 'TEST-BATCH',
                  completed_at: '2026-09-01T00:00:00Z'
                }
              }
            ],
            stockIssues: [],
            retailerMovements: []
          }
        })
      if (url.pathname === '/api/partners') {
        if (request.method() === 'GET') {
          const source =
            url.searchParams.get('kind') === 'supplier' ? suppliers : retailers
          return route.fulfill({
            json: {
              partners: source.map(partner => ({
                id: partner.id,
                name: partner.supplier_name ?? partner.retailer_name,
                supplier_kind: partner.supplier_kind,
                delivery_location: partner.delivery_location,
                contact_name: partner.contact_name,
                phone: partner.phone,
                email: partner.email,
                notes: partner.notes,
                is_active: partner.is_active ?? true
              }))
            }
          })
        }
        const body = request.postDataJSON()
        const source = body.kind === 'supplier' ? suppliers : retailers
        profileUpdates.push(body)
        const partner = source.find(item => item.id === body.id)
        Object.assign(partner, {
          supplier_name: body.kind === 'supplier' ? body.name : undefined,
          retailer_name: body.kind === 'retailer' ? body.name : undefined,
          supplier_kind: body.supplierKind,
          delivery_location: body.deliveryLocation,
          contact_name: body.contactName,
          phone: body.phone,
          email: body.email,
          notes: body.notes,
          is_active: body.isActive
        })
        return route.fulfill({ json: { id: body.id } })
      }
      if (url.pathname === '/api/write') {
        const action = url.searchParams.get('action'),
          body = request.postDataJSON()
        validateAction(action, body)
        requests.push({
          action,
          body,
          key: request.headers()['idempotency-key']
        })
        if (requests.length === 1) return route.abort('failed')
        if (action === 'suppliers')
          suppliers.push({
            id: 101,
            supplier_name: body.name,
            supplier_kind: body.supplierKind,
            phone: body.phone,
            contact_name: body.contactName,
            email: body.email,
            notes: body.notes,
            is_active: true
          })
        else
          retailers.push({
            id: 102,
            retailer_name: body.name,
            delivery_location: body.deliveryLocation,
            contact_name: body.contactName,
            phone: body.phone,
            email: body.email,
            notes: body.notes,
            is_active: true
          })
        return route.fulfill({
          status: 201,
          json: { id: action === 'suppliers' ? 101 : 102 }
        })
      }
      return route.fulfill({ status: 404 })
    })
    await page.goto('/#/operations')
    await openHeaderAction(page, 'Add supplier')
    await page
      .getByRole('button', { name: 'Save supplier', exact: true })
      .click()
    // MF-10: the summary lists the error and focus moves to the first field.
    await expect(
      page
        .getByRole('alert')
        .getByRole('link', { name: 'Supplier name: This field is required.' })
    ).toBeVisible()
    await expect(
      page.getByLabel('Supplier name', { exact: true })
    ).toBeFocused()
    expect(requests).toHaveLength(0)
    await page
      .getByLabel('Supplier name', { exact: true })
      .fill('Added honey supplier')
    await page
      .getByLabel('Contact person', { exact: true })
      .fill('Supply contact')
    await page.getByLabel('Phone number', { exact: true }).fill('0700000000')
    await page
      .getByRole('button', { name: 'Save supplier', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Retry saved submission' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Save supplier', exact: true })
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Retry saved submission' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(requests[0]).toEqual(requests[1])
    await page.getByRole('tab', { name: 'Receipt form' }).click()
    await expect(page.getByLabel('Supplier', { exact: true })).toHaveValue(
      /Added honey supplier/
    )
    await openHeaderAction(page, 'Manage suppliers')
    await page
      .getByLabel('Search suppliers', { exact: true })
      .fill('0700000000')
    await expect(
      page
        .getByRole('dialog')
        .getByText('Added honey supplier', { exact: true })
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'View and edit Added honey supplier' })
      .click()
    await page
      .getByLabel('Supplier name', { exact: true })
      .fill('Updated honey supplier')
    await page.getByLabel('Supplier type', { exact: true }).click()
    await page.getByRole('option').filter({ hasText: 'Raw honey' }).click()
    await page.getByLabel('Supplier active', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Save profile', exact: true })
      .click()
    await expect(
      page.getByText('Supplier profile saved.', { exact: true })
    ).toBeVisible()
    await page.getByLabel('Search suppliers', { exact: true }).fill('updated')
    await expect(page.getByText('Inactive', { exact: true })).toBeVisible()
    expect(profileUpdates[0]).toMatchObject({
      kind: 'supplier',
      name: 'Updated honey supplier',
      supplierKind: 'raw_honey',
      isActive: false
    })
    await page.getByRole('button', { name: 'Close supplier profiles' }).click()
    await page.goto('/#/retail')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Warehouse and retail stock'
      })
    ).toBeVisible()
    await openHeaderAction(page, 'Add retailer')
    await page
      .getByLabel('Retailer name', { exact: true })
      .fill('Added retail shop')
    await page
      .getByLabel('Delivery location', { exact: true })
      .fill('Ntinda, Kampala')
    await page
      .getByRole('button', { name: 'Save retailer', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Issue stock', exact: true }).click()
    await expect(
      page.getByLabel('Retail partner', { exact: true })
    ).toHaveValue(/Added retail shop/)
    await openHeaderAction(page, 'Manage retailers')
    await page.getByLabel('Search retailers', { exact: true }).fill('Ntinda')
    await page
      .getByRole('button', { name: 'View and edit Added retail shop' })
      .click()
    await page
      .getByLabel('Delivery location', { exact: true })
      .fill('Kira, Wakiso')
    await page.getByLabel('Retailer active', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Save profile', exact: true })
      .click()
    await expect(
      page.getByText('Retailer profile saved.', { exact: true })
    ).toBeVisible()
    expect(profileUpdates[1]).toMatchObject({
      kind: 'retailer',
      deliveryLocation: 'Kira, Wakiso',
      isActive: false
    })
    await page.getByLabel('Search retailers', { exact: true }).fill('')
    await page.getByLabel('Status', { exact: true }).click()
    await page.getByRole('option').filter({ hasText: 'Inactive' }).click()
    await expect(
      page.getByRole('dialog').getByText('Added retail shop', { exact: true })
    ).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
      )
      .toBe(true)
    expect(errors).toEqual([])
  })
