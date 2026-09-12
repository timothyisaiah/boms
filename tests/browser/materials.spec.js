import { test, expect } from '@playwright/test'
import { validateAction } from '../../server/validation.ts'

async function fixtures(page, role = 'admin_owner') {
  const materials = [],
    requests = [],
    savedKeys = new Map()
  let loseResponse = true
  await page.route('**/api/**', async route => {
    const request = route.request(),
      url = new URL(request.url())
    if (url.pathname === '/api/auth')
      return route.fulfill({
        json: {
          user: {
            id: 'material-ui-test',
            role,
            is_active: true,
            email: 'materials@example.invalid'
          }
        }
      })
    if (url.pathname === '/api/workspace')
      return route.fulfill({
        json: {
          mode: 'live',
          materials: materials.filter(m => m.is_active),
          suppliers: [
            { id: 1, supplier_name: 'Supply partner', supplier_kind: 'mixed' }
          ],
          variants: [],
          inventoryLots: [],
          batches: [],
          recipes: [],
          purchases: []
        }
      })
    if (url.pathname === '/api/materials')
      return route.fulfill({ json: { materials } })
    if (url.pathname === '/api/write') {
      const body = validateAction(
          url.searchParams.get('action'),
          request.postDataJSON()
        ),
        key = request.headers()['idempotency-key']
      requests.push({ body, key })
      if (savedKeys.has(key)) return route.fulfill({ json: savedKeys.get(key) })
      if (
        materials.some(
          m =>
            m.code.toLowerCase() === body.code.toLowerCase() && m.id !== body.id
        )
      )
        return route.fulfill({
          status: 409,
          json: {
            error:
              'Another material already uses this code. Choose a different code.',
            kind: 'conflict'
          }
        })
      const record = {
        id: body.id ?? materials.length + 1,
        code: body.code,
        name: body.name,
        kind: body.kind,
        unit_of_measure: body.unitOfMeasure,
        description: body.description,
        low_stock_threshold: body.lowStockThreshold,
        is_active: body.isActive,
        quantity_on_hand: '0.000'
      }
      if (body.id)
        Object.assign(
          materials.find(m => m.id === body.id),
          record
        )
      else materials.push(record)
      savedKeys.set(key, { id: record.id })
      if (loseResponse) {
        loseResponse = false
        return route.abort('failed')
      }
      return route.fulfill({
        status: body.id ? 200 : 201,
        json: { id: record.id }
      })
    }
    return route.fulfill({ status: 404 })
  })
  return { materials, requests }
}

for (const width of [375, 1280])
  test(`create, retry, edit and reactivate supply materials at ${width}px`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 844 })
    const { materials, requests } = await fixtures(page)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/#/operations')
    await page
      .getByRole('button', { name: 'Add material', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Save material', exact: true })
      .click()
    await expect(
      page.getByText('This field is required.').first()
    ).toBeVisible()
    expect(requests).toHaveLength(0)
    await page.getByLabel('Material code', { exact: true }).fill('JAR-500')
    await page
      .getByLabel('Material name', { exact: true })
      .fill('500g glass jar')
    await page.getByLabel('Material type', { exact: true }).click()
    await page.getByRole('option').filter({ hasText: 'Packaging' }).click()
    await page.getByLabel('Unit of measure', { exact: true }).fill('pieces')
    await page.getByLabel('Low-stock threshold', { exact: true }).fill('20.125')
    await page
      .getByLabel('Description', { exact: true })
      .fill('Glass with screw lid')
    await page
      .getByRole('button', { name: 'Save material', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Retry saved submission' })
    ).toBeVisible()
    await expect(
      page.getByLabel('Material name', { exact: true })
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Save material', exact: true })
    ).toBeDisabled()
    // A committed write with a lost response survives reload without duplicating it.
    await page.reload()
    await page
      .getByRole('button', { name: 'Add material', exact: true })
      .click()
    await expect(page.getByLabel('Material name', { exact: true })).toHaveValue(
      '500g glass jar'
    )
    await page.getByRole('button', { name: 'Retry saved submission' }).click()
    await expect(
      page.getByText('Material saved.', { exact: true })
    ).toBeVisible()
    expect(requests[0]).toEqual(requests[1])
    expect(materials).toHaveLength(1)
    const manager = page.getByRole('dialog')
    await expect(
      manager.getByText('500g glass jar', { exact: true })
    ).toBeVisible()
    await page.getByLabel('Search materials', { exact: true }).fill('screw lid')
    await page
      .getByRole('button', { name: 'Edit 500g glass jar', exact: true })
      .click()
    await expect(page.getByText('Material type', { exact: true })).toBeVisible()
    await expect(
      page.getByLabel('Unit of measure', { exact: true })
    ).toBeDisabled()
    await page
      .getByLabel('Material name', { exact: true })
      .fill('500g jar and lid')
    await page.getByLabel('Low-stock threshold', { exact: true }).fill('35.500')
    await page.getByLabel('Material active', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Save material', exact: true })
      .click()
    await expect(manager.getByText('Inactive', { exact: true })).toBeVisible()
    expect(materials[0]).toMatchObject({
      name: '500g jar and lid',
      low_stock_threshold: '35.500',
      is_active: false
    })
    await page.getByRole('button', { name: 'Close material manager' }).click()
    await page.getByRole('tab', { name: 'Receipt form' }).click()
    await expect(page.getByText('Material', { exact: true })).toBeVisible()
    expect(materials.filter(material => material.is_active)).toHaveLength(0)
    await page
      .getByRole('button', { name: 'Manage materials', exact: true })
      .click()
    await page.getByLabel('Material status', { exact: true }).click()
    await page
      .getByRole('option')
      .filter({ hasText: /^Inactive$/ })
      .click()
    await page
      .getByRole('button', { name: 'Edit 500g jar and lid', exact: true })
      .click()
    await page.getByLabel('Material active', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Save material', exact: true })
      .click()
    await expect(manager.getByText('Active', { exact: true })).toBeVisible()
    await page.screenshot({
      path: `.tmp/materials-${width}.png`,
      fullPage: true
    })
    await page.getByRole('button', { name: 'Close material manager' }).click()
    await page.getByLabel('Material', { exact: true }).click()
    await page
      .getByRole('option')
      .filter({ hasText: '500g jar and lid (pieces)' })
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByLabel('Material', { exact: true })).toHaveValue(
      '500g jar and lid (pieces)'
    )
    await page
      .getByRole('button', { name: 'Add material', exact: true })
      .click()
    await page.getByLabel('Material code', { exact: true }).fill('jar-500')
    await page.getByLabel('Material name', { exact: true }).fill('Duplicate')
    await page
      .getByRole('button', { name: 'Save material', exact: true })
      .click()
    await expect(
      page.getByText(
        'Another material already uses this code. Choose a different code.'
      )
    ).toBeVisible()
    await page.getByLabel('Material code', { exact: true }).fill('HONEY-RAW')
    await page.getByLabel('Material name', { exact: true }).fill('Raw honey')
    await page
      .getByRole('button', { name: 'Save material', exact: true })
      .click()
    await expect(manager.getByText('Raw honey', { exact: true })).toBeVisible()
    expect(materials).toHaveLength(2)
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
      )
      .toBe(true)
    expect(errors).toEqual([])
  })

test('production staff can view materials but cannot create or edit them', async ({
  page
}) => {
  await fixtures(page, 'production_staff')
  await page.goto('/#/operations')
  await expect(
    page.getByRole('button', { name: 'Add material', exact: true })
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Manage materials', exact: true })
    .click()
  await expect(
    page.getByLabel('Search materials', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Add material', exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByText('No materials match this search and filters.')
  ).toBeVisible()
})
