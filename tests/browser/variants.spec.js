import { test, expect } from '@playwright/test'
import { validateAction } from '../../server/validation.ts'

async function fixtures(page, role = 'admin_owner') {
  const variants = [],
    products = [],
    requests = [],
    savedKeys = new Map()
  let loseResponse = true
  const material = {
    id: 1,
    name: 'Honey',
    kind: 'raw_honey',
    unit_of_measure: 'kg'
  }
  await page.route('**/api/**', async route => {
    const request = route.request(),
      url = new URL(request.url())
    if (url.pathname === '/api/auth')
      return route.fulfill({
        json: {
          user: {
            id: 'variant-ui-test',
            role,
            is_active: true,
            email: 'variants@example.invalid'
          }
        }
      })
    if (url.pathname === '/api/workspace')
      return route.fulfill({
        json: {
          mode: 'live',
          variants: variants.filter(variant => variant.is_active),
          materials: [material],
          suppliers: [
            {
              id: 1,
              supplier_name: 'Supply partner',
              supplier_kind: 'raw_honey'
            }
          ],
          purchases: [],
          recipes: [],
          batches: [],
          inventoryLots: [
            {
              id: 1,
              lot_code: 'HONEY-LOT',
              quantity_remaining: '10.000',
              unit_cost: '10000.00',
              material
            }
          ]
        }
      })
    if (url.pathname === '/api/variants')
      return route.fulfill({ json: { variants, products } })
    if (url.pathname === '/api/write') {
      const action = url.searchParams.get('action'),
        body = validateAction(action, request.postDataJSON()),
        key = request.headers()['idempotency-key']
      requests.push({ action, body, key })
      if (savedKeys.has(key)) return route.fulfill({ json: savedKeys.get(key) })
      if (action !== 'variants')
        return route.fulfill({
          status: 422,
          json: { error: 'Unexpected action.', kind: 'validation' }
        })
      if (
        variants.some(
          variant =>
            variant.sku.toLowerCase() === body.sku.toLowerCase() &&
            variant.id !== body.id
        )
      )
        return route.fulfill({
          status: 409,
          json: {
            error:
              'Another variant already uses this SKU. Choose a different SKU.',
            kind: 'conflict'
          }
        })
      let product
      if (body.productId)
        product = products.find(item => item.id === body.productId)
      else {
        product = {
          id: products.length + 1,
          name: body.newProductName,
          description: body.newProductDescription,
          is_active: true
        }
        products.push(product)
      }
      const variant = {
        id: body.id ?? variants.length + 1,
        product_id: product.id,
        product,
        sku: body.sku,
        variant_name: body.variantName,
        flavor: body.flavor,
        pack_size_grams: body.packSizeGrams,
        packaging_type: body.packagingType,
        low_stock_threshold: body.lowStockThreshold,
        is_active: body.isActive,
        quantity_on_hand: '0'
      }
      if (body.id)
        Object.assign(
          variants.find(item => item.id === body.id),
          variant
        )
      else variants.push(variant)
      const result = { id: variant.id, productId: product.id }
      savedKeys.set(key, result)
      if (loseResponse) {
        loseResponse = false
        return route.abort('failed')
      }
      return route.fulfill({ status: body.id ? 200 : 201, json: result })
    }
    return route.fulfill({ status: 404 })
  })
  return { variants, products, requests }
}

for (const width of [375, 1280])
  test(`create, retry, manage and select variants for a batch at ${width}px`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 844 })
    const { variants, products, requests } = await fixtures(page)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/#/operations')
    await page.getByRole('button', { name: 'Add variant', exact: true }).click()
    await page
      .getByRole('button', { name: 'Save variant', exact: true })
      .click()
    await expect(
      page.getByText('Select a product or create a new one.')
    ).toBeVisible()
    expect(requests).toHaveLength(0)
    await page
      .getByLabel('Create a new product for this variant', { exact: true })
      .click()
    await page
      .getByLabel('New product name', { exact: true })
      .fill('Beecone natural honey')
    await page
      .getByLabel('Product description', { exact: true })
      .fill('Natural honey range')
    await page.getByLabel('SKU', { exact: true }).fill('HNY-500-CL')
    await page
      .getByLabel('Variant name', { exact: true })
      .fill('Classic honey 500g')
    await page.getByLabel('Flavour', { exact: true }).fill('Classic')
    await page.getByLabel('Pack size (grams)', { exact: true }).fill('500')
    await page.getByLabel('Packaging type', { exact: true }).fill('Glass jar')
    await page.getByLabel('Low-stock threshold', { exact: true }).fill('12')
    await page
      .getByRole('button', { name: 'Save variant', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Retry saved submission' })
    ).toBeVisible()
    await expect(
      page.getByLabel('Variant name', { exact: true })
    ).toBeDisabled()
    await page.reload()
    await page.getByRole('button', { name: 'Add variant', exact: true }).click()
    await expect(page.getByLabel('Variant name', { exact: true })).toHaveValue(
      'Classic honey 500g'
    )
    await page.getByRole('button', { name: 'Retry saved submission' }).click()
    await expect(
      page.getByText(
        'Variant saved. It is ready to select in a new production batch.'
      )
    ).toBeVisible()
    expect(requests[0]).toEqual(requests[1])
    expect(products).toHaveLength(1)
    expect(variants).toHaveLength(1)
    const manager = page.getByRole('dialog')
    await expect(
      manager.getByText('Classic honey 500g', { exact: true })
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Edit Classic honey 500g', exact: true })
      .click()
    await expect(page.getByLabel('Product', { exact: true })).toBeDisabled()
    await page
      .getByLabel('Variant name', { exact: true })
      .fill('Classic honey 500 gram jar')
    await page.getByLabel('Low-stock threshold', { exact: true }).fill('20')
    await page.getByLabel('Variant active', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Save variant', exact: true })
      .click()
    await expect(manager.getByText('Inactive', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close variant manager' }).click()
    await page.getByRole('tab', { name: 'Batch form', exact: true }).click()
    await expect(
      page.getByText('Finished variant', { exact: true })
    ).toBeVisible()
    expect(variants.filter(variant => variant.is_active)).toHaveLength(0)
    await page
      .getByRole('button', { name: 'Manage variants', exact: true })
      .click()
    await page.getByLabel('Variant status', { exact: true }).click()
    await page
      .getByRole('option')
      .filter({ hasText: /^Inactive$/ })
      .click()
    await page
      .getByRole('button', {
        name: 'Edit Classic honey 500 gram jar',
        exact: true
      })
      .click()
    await page.getByLabel('Variant active', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Save variant', exact: true })
      .click()
    await expect(manager.getByText('Active', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close variant manager' }).click()
    await page.getByLabel('Finished variant', { exact: true }).click()
    await page
      .getByRole('option')
      .filter({ hasText: 'HNY-500-CL / Classic honey 500 gram jar' })
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(
      page.getByLabel('Finished variant', { exact: true })
    ).toHaveValue('HNY-500-CL / Classic honey 500 gram jar')
    await page.getByRole('button', { name: 'Add variant', exact: true }).click()
    await page.getByLabel('Product', { exact: true }).click()
    await page
      .getByRole('option')
      .filter({ hasText: 'Beecone natural honey' })
      .click()
    await page.getByLabel('SKU', { exact: true }).fill('hny-500-cl')
    await page.getByLabel('Variant name', { exact: true }).fill('Duplicate SKU')
    await page.getByLabel('Pack size (grams)', { exact: true }).fill('250')
    await page
      .getByRole('button', { name: 'Save variant', exact: true })
      .click()
    await expect(
      page.getByText(
        'Another variant already uses this SKU. Choose a different SKU.'
      )
    ).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
      )
      .toBe(true)
    expect(errors).toEqual([])
  })

test('production staff can view variants but cannot add or edit them', async ({
  page
}) => {
  await fixtures(page, 'production_staff')
  await page.goto('/#/operations')
  await expect(
    page.getByRole('button', { name: 'Add variant', exact: true })
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Manage variants', exact: true })
    .click()
  await expect(
    page.getByLabel('Search variants', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Add variant', exact: true })
  ).toHaveCount(0)
})
