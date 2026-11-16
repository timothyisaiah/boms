import { z } from 'zod'
import { HttpError } from './http.js'
const id = z.union([
  z.number().int().positive().safe(),
  z.string().regex(/^[1-9]\d*$/)
])
const nullableId = id.nullish()
const text = z.string().trim().max(2000).nullish()
const stamp = z.iso.datetime({ offset: true })
const decimal = (scale: number, positive = true) =>
  z
    .union([z.number().finite(), z.string().regex(/^\d+(\.\d+)?$/)])
    .refine(
      v =>
        Number(v) >= (positive ? 10 ** -scale : 0) &&
        Number(v) < 1e11 &&
        new RegExp(`^\\d+(\\.\\d{1,${scale}})?$`).test(String(v)),
      'Enter a valid amount with the allowed decimal places.'
    )
const quantity = z.number().int().nonnegative().max(2147483647)
const line = z.strictObject({
  stock_issue_item_id: id,
  quantity_sold: quantity,
  quantity_returned: quantity,
  quantity_damaged: quantity,
  quantity_expired: quantity.default(0),
  quantity_remaining: quantity,
  return_reason: text,
  notes: text
})
const reconcile = z.strictObject({
  retailerId: id,
  reconciledAt: stamp,
  reconciliationReference: text,
  notes: text,
  items: z.array(line).min(1).max(100)
})
const partnerFields = {
  name: z.string().trim().min(1).max(160),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.email(), z.literal('')]).optional(),
  notes: text
}
const schemas: Record<string, z.ZodType> = {
  variants: z
    .strictObject({
      id: id.optional(),
      productId: nullableId,
      newProductName: z.string().trim().max(160).optional(),
      newProductDescription: z.string().trim().max(2000).optional(),
      sku: z.string().trim().min(1).max(80),
      variantName: z.string().trim().min(1).max(160),
      flavor: z.string().trim().min(1).max(100),
      packSizeGrams: z.number().int().positive().max(2147483647),
      packagingType: z.string().trim().min(1).max(100),
      lowStockThreshold: z.number().int().nonnegative().max(2147483647),
      isActive: z.boolean()
    })
    .superRefine((value, context) => {
      if (
        !value.id &&
        Boolean(value.productId) === Boolean(value.newProductName)
      )
        context.addIssue({
          code: 'custom',
          path: ['productId'],
          message: 'Select a product or enter a new product name.'
        })
      if (value.id && value.newProductName)
        context.addIssue({
          code: 'custom',
          path: ['newProductName'],
          message: 'An existing variant cannot be moved to another product.'
        })
    }),
  materials: z.strictObject({
    id: id.optional(),
    code: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(160),
    kind: z.enum(['raw_honey', 'packaging', 'spice']),
    unitOfMeasure: z.string().trim().min(1).max(40),
    description: z.string().trim().max(2000),
    lowStockThreshold: decimal(3, false),
    isActive: z.boolean()
  }),
  suppliers: z.strictObject({
    ...partnerFields,
    supplierKind: z.enum(['raw_honey', 'packaging', 'mixed', 'spice'])
  }),
  retailers: z.strictObject({
    ...partnerFields,
    deliveryLocation: z.string().trim().max(300).optional()
  }),
  purchases: z.strictObject({
    supplierId: id,
    purchasedAt: stamp,
    purchaseReference: text,
    notes: text,
    items: z
      .array(
        z.strictObject({
          material_id: id,
          quantity: decimal(3),
          unit_cost: decimal(2, false),
          lot_code: text
        })
      )
      .min(1)
      .max(100)
  }),
  production: z.strictObject({
    variantId: id,
    batchCode: z.string().trim().min(1).max(120),
    startedAt: stamp,
    expiresAt: z.iso.date().nullish(),
    notes: text,
    outputQuantity: quantity.positive(),
    inputs: z
      .array(
        z
          .strictObject({
            inventory_lot_id: nullableId,
            material_id: nullableId,
            quantity: decimal(3)
          })
          .refine(
            v => Boolean(v.inventory_lot_id) !== Boolean(v.material_id),
            'Select a lot or a material for FIFO.'
          )
      )
      .min(1)
      .max(100)
  }),
  'stock-issues': z.strictObject({
    retailerId: id,
    issuedAt: stamp,
    issueReference: text,
    notes: text,
    items: z
      .array(
        z
          .strictObject({
            production_output_id: nullableId,
            variant_id: nullableId,
            quantity: quantity.positive(),
            notes: text
          })
          .refine(
            v => Boolean(v.production_output_id) !== Boolean(v.variant_id),
            'Select a batch or variant for FIFO.'
          )
      )
      .min(1)
      .max(100)
  }),
  'production-run': z.strictObject({
    producedAt: stamp,
    notes: text,
    items: z
      .array(z.strictObject({ variant_id: id, quantity: quantity }))
      .min(1)
      .max(50)
      .refine(
        items => items.some(item => item.quantity > 0),
        'Choose how many jars to make.'
      )
  }),
  'direct-sales': z.strictObject({
    soldAt: stamp,
    customerName: text,
    paymentMethod: z.enum(['cash', 'mobile_money', 'bank', 'other']),
    saleReference: text,
    notes: text,
    items: z
      .array(z.strictObject({ variant_id: id, quantity: quantity.positive() }))
      .min(1)
      .max(50)
  }),
  'retailer-checkins': z.strictObject({
    retailerId: id,
    checkedAt: stamp,
    notes: text,
    counts: z
      .array(
        z.strictObject({
          variant_id: id,
          remaining: quantity,
          damaged: quantity.default(0)
        })
      )
      .max(100),
    amount: decimal(2, false).nullish(),
    paymentReference: text
  }),
  'variant-barcode': z.strictObject({
    variantId: id,
    barcode: z.union([
      z
        .string()
        .trim()
        .regex(/^[0-9A-Za-z-]{4,64}$/, 'Enter a valid barcode.'),
      z.literal('')
    ])
  }),
  reconciliations: reconcile,
  returns: reconcile,
  remittances: z.strictObject({
    retailerId: id,
    reconciliationId: nullableId,
    receivedAt: stamp,
    amount: decimal(2),
    remittanceReference: text,
    notes: text
  }),
  expenses: z.strictObject({
    expenseCategory: z.string().trim().min(1).max(100),
    incurredAt: stamp,
    amount: decimal(2),
    vendorName: text,
    expenseReference: text,
    notes: text
  }),
  prices: z.strictObject({
    variantId: id,
    unitPrice: decimal(2, false),
    effectiveFrom: stamp
  }),
  recipes: z.strictObject({
    variantId: id,
    name: z.string().trim().min(1).max(100),
    items: z
      .array(z.strictObject({ materialId: id, quantityPerUnit: decimal(6) }))
      .min(1)
      .max(100)
  })
}
export function validateAction(action: string, body: unknown) {
  const schema = schemas[action]
  if (!schema) throw new HttpError(404, 'Unknown action.')
  const result = schema.safeParse(body)
  if (!result.success)
    throw new HttpError(
      422,
      result.error.issues
        .map(i => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
    )
  return result.data
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(',')}}`
  return JSON.stringify(value)
}
