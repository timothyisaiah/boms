import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const previewWorkspace = Object.freeze({
  mode: 'preview',
  variants: [
    {
      id: 2001,
      sku: 'BEE-RAW-250',
      variant_name: '250g Classic Jar',
      flavor: 'Classic',
      pack_size_grams: 250,
      packaging_type: 'Jar',
      product: {
        id: 1001,
        name: 'Beecone Raw Natural Honey'
      }
    },
    {
      id: 2002,
      sku: 'BEE-RAW-500',
      variant_name: '500g Classic Jar',
      flavor: 'Classic',
      pack_size_grams: 500,
      packaging_type: 'Jar',
      product: {
        id: 1001,
        name: 'Beecone Raw Natural Honey'
      }
    },
    {
      id: 2003,
      sku: 'BEE-RAW-1000',
      variant_name: '1kg Classic Jar',
      flavor: 'Classic',
      pack_size_grams: 1000,
      packaging_type: 'Jar',
      product: {
        id: 1001,
        name: 'Beecone Raw Natural Honey'
      }
    },
    {
      id: 2004,
      sku: 'BEE-GIN-500',
      variant_name: '500g Ginger Infused Jar',
      flavor: 'Ginger Infused',
      pack_size_grams: 500,
      packaging_type: 'Jar',
      product: {
        id: 1001,
        name: 'Beecone Raw Natural Honey'
      }
    }
  ],
  materials: [
    {
      id: 3001,
      code: 'RAW-HONEY-KG',
      name: 'Raw Honey',
      kind: 'raw_honey',
      unit_of_measure: 'kg'
    },
    {
      id: 3002,
      code: 'JAR-250',
      name: '250g PET Jar',
      kind: 'packaging',
      unit_of_measure: 'piece'
    },
    {
      id: 3003,
      code: 'JAR-500',
      name: '500g PET Jar',
      kind: 'packaging',
      unit_of_measure: 'piece'
    },
    {
      id: 3004,
      code: 'JAR-1000',
      name: '1kg PET Jar',
      kind: 'packaging',
      unit_of_measure: 'piece'
    },
    {
      id: 3005,
      code: 'LID-63MM',
      name: '63mm Gold Twist Lid',
      kind: 'packaging',
      unit_of_measure: 'piece'
    },
    {
      id: 3006,
      code: 'LABEL-FRONT',
      name: 'Beecone Front Label',
      kind: 'packaging',
      unit_of_measure: 'piece'
    },
    {
      id: 3007,
      code: 'SEAL-TAMPER',
      name: 'Tamper Seal',
      kind: 'packaging',
      unit_of_measure: 'piece'
    },
    {
      id: 3008,
      code: 'CARTON-12',
      name: '12-Jar Master Carton',
      kind: 'packaging',
      unit_of_measure: 'piece'
    }
  ],
  suppliers: [
    {
      id: 4001,
      supplier_name: 'Kayunga Honey Cooperative',
      supplier_kind: 'raw_honey'
    },
    {
      id: 4002,
      supplier_name: 'Kampala Pack House',
      supplier_kind: 'packaging'
    },
    {
      id: 4003,
      supplier_name: 'Nile Print and Label',
      supplier_kind: 'packaging'
    },
    {
      id: 4004,
      supplier_name: 'Beecone Mixed Inputs Depot',
      supplier_kind: 'mixed'
    }
  ],
  purchases: [],
  inventoryLots: [],
  batches: []
})

function clonePreviewWorkspace() {
  return JSON.parse(JSON.stringify(previewWorkspace))
}

function throwIfError(error) {
  if (error) {
    throw error
  }
}

export function getPreviewOperationsWorkspace() {
  return clonePreviewWorkspace()
}

export function formatOperationsError(error, fallbackMessage) {
  const messageParts = []

  if (error instanceof Error && error.message) {
    messageParts.push(error.message)
  } else if (typeof error?.message === 'string' && error.message) {
    messageParts.push(error.message)
  }

  if (typeof error?.details === 'string' && error.details) {
    messageParts.push(error.details)
  }

  if (typeof error?.hint === 'string' && error.hint) {
    messageParts.push(`Hint: ${error.hint}`)
  }

  if (messageParts.length > 0) {
    return messageParts.join(' ')
  }

  return fallbackMessage
}

export async function fetchOperationsWorkspace() {
  if (!supabase || !isSupabaseConfigured) {
    return clonePreviewWorkspace()
  }

  const [
    variantsResult,
    materialsResult,
    suppliersResult,
    purchasesResult,
    inventoryLotsResult,
    batchesResult
  ] = await Promise.all([
    supabase
      .from('product_variants')
      .select(
        `
          id,
          sku,
          variant_name,
          flavor,
          pack_size_grams,
          packaging_type,
          is_active,
          product:products (
            id,
            name,
            slug
          )
        `
      )
      .eq('is_active', true)
      .order('pack_size_grams', { ascending: true }),
    supabase
      .from('materials')
      .select(
        `
          id,
          code,
          name,
          kind,
          unit_of_measure,
          description,
          is_active
        `
      )
      .eq('is_active', true)
      .order('kind', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('suppliers')
      .select(
        `
          id,
          supplier_name,
          supplier_kind,
          contact_name,
          phone,
          email,
          is_active
        `
      )
      .eq('is_active', true)
      .order('supplier_name', { ascending: true }),
    supabase
      .from('purchases')
      .select(
        `
          id,
          purchase_reference,
          purchased_at,
          status,
          total_amount,
          notes,
          supplier:suppliers (
            id,
            supplier_name
          ),
          items:purchase_items (
            id,
            line_number,
            lot_code,
            quantity,
            unit_cost,
            line_total,
            material:materials (
              id,
              name,
              unit_of_measure,
              kind
            )
          )
        `
      )
      .order('purchased_at', { ascending: false })
      .limit(6),
    supabase
      .from('inventory_lots')
      .select(
        `
          id,
          lot_code,
          quantity_received,
          quantity_remaining,
          unit_cost,
          received_at,
          status,
          material:materials (
            id,
            name,
            kind,
            unit_of_measure
          ),
          supplier:suppliers (
            id,
            supplier_name
          )
        `
      )
      .eq('status', 'open')
      .order('received_at', { ascending: true }),
    supabase
      .from('production_batches')
      .select(
        `
          id,
          batch_code,
          started_at,
          completed_at,
          status,
          total_input_cost,
          total_output_quantity,
          output_unit_cost,
          notes,
          variant:product_variants (
            id,
            sku,
            variant_name,
            flavor,
            pack_size_grams,
            packaging_type,
            product:products (
              id,
              name
            )
          ),
          inputs:production_inputs (
            id,
            line_number,
            quantity_consumed,
            unit_cost,
            total_cost,
            lot:inventory_lots (
              id,
              lot_code
            ),
            material:materials (
              id,
              name,
              unit_of_measure
            )
          ),
          outputs:production_outputs (
            id,
            line_number,
            quantity_produced,
            quantity_remaining,
            unit_cost,
            total_cost
          )
        `
      )
      .order('started_at', { ascending: false })
      .limit(25)
  ])

  throwIfError(variantsResult.error)
  throwIfError(materialsResult.error)
  throwIfError(suppliersResult.error)
  throwIfError(purchasesResult.error)
  throwIfError(inventoryLotsResult.error)
  throwIfError(batchesResult.error)

  return {
    mode: 'live',
    variants: variantsResult.data ?? [],
    materials: materialsResult.data ?? [],
    suppliers: suppliersResult.data ?? [],
    purchases: purchasesResult.data ?? [],
    inventoryLots: inventoryLotsResult.data ?? [],
    batches: batchesResult.data ?? []
  }
}

export async function recordPurchase(payload) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured yet. Add project keys before recording purchases.'
    )
  }

  const { data, error } = await supabase.rpc('record_purchase', {
    p_supplier_id: payload.supplierId,
    p_purchased_at: payload.purchasedAt,
    p_purchase_reference: payload.purchaseReference,
    p_notes: payload.notes,
    p_items: payload.items
  })

  throwIfError(error)

  return data
}

export async function recordProductionBatch(payload) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured yet. Add project keys before recording production batches.'
    )
  }

  const { data, error } = await supabase.rpc('record_production_batch', {
    p_variant_id: payload.variantId,
    p_batch_code: payload.batchCode,
    p_started_at: payload.startedAt,
    p_notes: payload.notes,
    p_output_quantity: payload.outputQuantity,
    p_inputs: payload.inputs
  })

  throwIfError(error)

  return data
}
