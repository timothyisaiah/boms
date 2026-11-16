// Pure helpers for the one-tap home flows (no Vue/Quasar imports so Node
// tests can load them). Quantities mirror the database: material amounts are
// rounded to 3 decimals per batch, money to whole shillings for display.
import { recipeQuantity } from './recipes.js'

const listOf = value => (Array.isArray(value) ? value : [])
const num = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const round3 = value => Math.round(value * 1000) / 1000

/** "60g", "400g", "1kg", "1.5kg". */
export function sizeLabel(grams) {
  const value = num(grams)
  if (value >= 1000) return `${round3(value / 1000)}kg`
  return `${value}g`
}

/** Display name for a flavor group, e.g. "Raw Honey", "Ginger Infused Honey". */
export function flavorLabel(flavor) {
  const text = String(flavor ?? '').trim()
  if (!text || /^(classic|raw|plain|natural)$/i.test(text)) return 'Raw Honey'
  return /honey/i.test(text) ? text : `${text} Honey`
}

/** "Raw Honey 60g" */
export function jarLabel(variant) {
  return `${flavorLabel(variant?.flavor)} ${sizeLabel(variant?.pack_size_grams)}`
}

/** Variants grouped by flavor (raw first), each group sorted by jar size. */
export function groupVariants(variants) {
  const groups = new Map()
  for (const variant of listOf(variants)) {
    const label = flavorLabel(variant.flavor)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(variant)
  }
  return [...groups.entries()]
    .map(([label, items]) => ({
      label,
      items: [...items].sort(
        (a, b) => num(a.pack_size_grams) - num(b.pack_size_grams)
      )
    }))
    .sort((a, b) =>
      a.label === 'Raw Honey'
        ? -1
        : b.label === 'Raw Honey'
          ? 1
          : a.label.localeCompare(b.label)
    )
}

/** `{ [variantId]: qty }` → `[{ variant_id, quantity }]` without zero lines. */
export function countsToItems(counts) {
  return Object.entries(counts ?? {})
    .map(([variantId, quantity]) => ({
      variant_id: Number(variantId),
      quantity: Math.max(0, Math.trunc(num(quantity)))
    }))
    .filter(item => item.quantity > 0)
}

export function totalJars(counts) {
  return countsToItems(counts).reduce((sum, item) => sum + item.quantity, 0)
}

/**
 * Materials a production run will consume, matching record_production_run:
 * per variant round(quantity_per_unit × jars, 3), summed per material.
 * Returns `{ lines, missingRecipes }`; each line has needed/onHand/short.
 */
export function computeRequirements(counts, recipes, materials, variants) {
  const recipeByVariant = new Map(
    listOf(recipes).map(recipe => [Number(recipe.variant_id), recipe])
  )
  const materialById = new Map(
    listOf(materials).map(material => [Number(material.id), material])
  )
  const variantById = new Map(
    listOf(variants).map(variant => [Number(variant.id), variant])
  )
  const needed = new Map()
  const missingRecipes = []
  for (const { variant_id: variantId, quantity } of countsToItems(counts)) {
    const recipe = recipeByVariant.get(variantId)
    if (!recipe || listOf(recipe.items).length === 0) {
      missingRecipes.push(variantById.get(variantId) ?? { id: variantId })
      continue
    }
    for (const item of recipe.items) {
      const materialId = Number(item.material_id)
      const amount = Number(recipeQuantity(item.quantity_per_unit, quantity))
      needed.set(materialId, round3((needed.get(materialId) ?? 0) + amount))
    }
  }
  const lines = [...needed.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([materialId, amount]) => {
      const material = materialById.get(materialId) ?? {
        id: materialId,
        name: 'Unknown material',
        unit_of_measure: ''
      }
      const onHand = num(material.on_hand)
      return { material, needed: amount, onHand, short: onHand < amount }
    })
    .sort((a, b) => kindOrder(a.material) - kindOrder(b.material))
  return { lines, missingRecipes }
}

const KIND_ORDER = { raw_honey: 0, spice: 1, packaging: 2 }
function kindOrder(material) {
  return KIND_ORDER[material?.kind] ?? 3
}

/** How many purchase units (e.g. jerricans) an amount in base units is. */
export function inPurchaseUnits(material, amount) {
  const size = num(material?.purchase_unit_size) || 1
  return round3(num(amount) / size)
}

function plural(word, count) {
  if (!word) return ''
  if (count === 1 || word.endsWith('s')) return word
  return `${word}s`
}

/**
 * "26 kg (1.3 jerricans)" for materials bought in bigger units; "120 pieces"
 * otherwise.
 */
export function formatMaterialAmount(material, amount) {
  const value = round3(num(amount))
  const unit = material?.unit_of_measure ?? ''
  const base =
    `${value.toLocaleString('en-US')} ${unit === 'piece' ? plural('piece', value) : unit}`.trim()
  const size = num(material?.purchase_unit_size) || 1
  const label = material?.purchase_unit_label
  if (!label || size === 1) return base
  const units = Math.round((value / size) * 100) / 100
  return `${base} (${units.toLocaleString('en-US')} ${plural(label, units)})`
}

/** Label for entering a delivery: "jerricans (20 kg each)" or "kg". */
export function purchaseUnitHint(material) {
  const size = num(material?.purchase_unit_size) || 1
  const label = material?.purchase_unit_label
  if (!label || size === 1)
    return material?.unit_of_measure === 'piece'
      ? 'pieces'
      : (material?.unit_of_measure ?? '')
  return `${plural(label, 2)} (${size} ${material.unit_of_measure} each)`
}

/** Purchase units entered by the user → base quantity string (3 dp). */
export function toBaseQuantity(material, purchaseUnits) {
  const size = num(material?.purchase_unit_size) || 1
  return round3(num(purchaseUnits) * size).toFixed(3)
}

/** Total paid for a delivery → unit cost per base unit (2 dp). */
export function unitCostFromTotal(totalPaid, baseQuantity) {
  const quantity = num(baseQuantity)
  if (quantity <= 0) return '0.00'
  return (Math.round((num(totalPaid) / quantity) * 100) / 100).toFixed(2)
}

/** Sale total at preset prices; `missing` lists variants without a price. */
export function basketTotal(counts, variants) {
  const byId = new Map(listOf(variants).map(v => [Number(v.id), v]))
  let total = 0
  const missing = []
  for (const { variant_id: variantId, quantity } of countsToItems(counts)) {
    const variant = byId.get(variantId)
    if (variant?.current_price === null || variant?.current_price === undefined)
      missing.push(variant ?? { id: variantId })
    else total += num(variant.current_price) * quantity
  }
  return { total, missing }
}

/** Variant whose shared barcode (or SKU, as a fallback) matches a scan. */
export function findVariantByCode(variants, code) {
  const value = String(code ?? '').trim()
  if (!value) return null
  const lower = value.toLowerCase()
  return (
    listOf(variants).find(v => v.barcode && String(v.barcode) === value) ??
    listOf(variants).find(v => String(v.sku ?? '').toLowerCase() === lower) ??
    null
  )
}

/** `{ [variantId]: { quantity, unit_price } }` held by one retailer. */
export function holdingsFor(retailerId, holdings) {
  const result = {}
  for (const row of listOf(holdings)) {
    if (Number(row.retailer_id) !== Number(retailerId)) continue
    result[Number(row.variant_id)] = {
      quantity: num(row.quantity),
      unitPrice:
        row.unit_price === null || row.unit_price === undefined
          ? null
          : num(row.unit_price)
    }
  }
  return result
}

/**
 * What a check-in will record: per variant sold = held − on shelf − damaged.
 * Returns `{ lines, soldJars, soldValue, invalid }`.
 */
export function checkinPreview(held, shelf, damaged = {}) {
  const lines = []
  let soldJars = 0
  let soldValue = 0
  let invalid = false
  for (const [variantId, holding] of Object.entries(held ?? {})) {
    const remaining = Math.max(0, Math.trunc(num(shelf?.[variantId])))
    const broken = Math.max(0, Math.trunc(num(damaged?.[variantId])))
    const sold = holding.quantity - remaining - broken
    if (sold < 0) invalid = true
    const value = Math.max(sold, 0) * num(holding.unitPrice)
    soldJars += Math.max(sold, 0)
    soldValue += value
    lines.push({
      variantId: Number(variantId),
      held: holding.quantity,
      remaining,
      damaged: broken,
      sold,
      value
    })
  }
  return { lines, soldJars, soldValue, invalid }
}
