import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const previewWorkspace = Object.freeze({
  mode: 'preview',
  retailers: [
    {
      id: 5001,
      retailer_name: 'Ntinda Health Market',
      contact_name: 'Irene Namubiru',
      delivery_location: 'Ntinda, Kampala'
    },
    {
      id: 5002,
      retailer_name: 'Entebbe Organics Corner',
      contact_name: 'Paul Ssemanda',
      delivery_location: 'Entebbe Road, Wakiso'
    },
    {
      id: 5003,
      retailer_name: 'Jinja Farmers Shop',
      contact_name: 'Naomi Auma',
      delivery_location: 'Jinja Main Street'
    }
  ],
  finishedStock: [
    {
      id: 7001,
      quantity_produced: 120,
      quantity_remaining: 78,
      unit_cost: 16850,
      batch: {
        id: 6001,
        batch_code: 'PB-20260729-001',
        started_at: '2026-07-29T09:00:00.000Z'
      },
      variant: {
        id: 2002,
        sku: 'BEE-RAW-500',
        variant_name: '500g Classic Jar',
        flavor: 'Classic',
        pack_size_grams: 500
      }
    },
    {
      id: 7002,
      quantity_produced: 96,
      quantity_remaining: 42,
      unit_cost: 30200,
      batch: {
        id: 6002,
        batch_code: 'PB-20260731-001',
        started_at: '2026-07-31T11:00:00.000Z'
      },
      variant: {
        id: 2003,
        sku: 'BEE-RAW-1000',
        variant_name: '1kg Classic Jar',
        flavor: 'Classic',
        pack_size_grams: 1000
      }
    },
    {
      id: 7003,
      quantity_produced: 144,
      quantity_remaining: 144,
      unit_cost: 17120,
      batch: {
        id: 6003,
        batch_code: 'PB-20260801-002',
        started_at: '2026-08-01T08:30:00.000Z'
      },
      variant: {
        id: 2004,
        sku: 'BEE-GIN-500',
        variant_name: '500g Ginger Infused Jar',
        flavor: 'Ginger Infused',
        pack_size_grams: 500
      }
    }
  ],
  stockIssues: [
    {
      id: 8001,
      issue_reference: 'DN-NTI-0004',
      issued_at: '2026-08-01T14:00:00.000Z',
      status: 'issued',
      total_quantity: 42,
      total_cost: 707700,
      notes: 'Weekend refill before promotional shelf display.',
      retailer: {
        id: 5001,
        retailer_name: 'Ntinda Health Market'
      },
      items: [
        {
          id: 8101,
          line_number: 1,
          quantity_issued: 42,
          unit_cost: 16850,
          total_cost: 707700,
          batch: {
            id: 6001,
            batch_code: 'PB-20260729-001'
          },
          variant: {
            id: 2002,
            sku: 'BEE-RAW-500',
            variant_name: '500g Classic Jar'
          }
        }
      ]
    }
  ],
  retailerMovements: [
    {
      id: 9001,
      movement_type: 'issue',
      quantity_delta: 42,
      unit_cost: 16850,
      moved_at: '2026-08-01T14:00:00.000Z',
      retailer: {
        id: 5001,
        retailer_name: 'Ntinda Health Market'
      },
      batch: {
        id: 6001,
        batch_code: 'PB-20260729-001'
      },
      variant: {
        id: 2002,
        sku: 'BEE-RAW-500',
        variant_name: '500g Classic Jar'
      }
    },
    {
      id: 9002,
      movement_type: 'issue',
      quantity_delta: 54,
      unit_cost: 30200,
      moved_at: '2026-08-01T16:15:00.000Z',
      retailer: {
        id: 5002,
        retailer_name: 'Entebbe Organics Corner'
      },
      batch: {
        id: 6002,
        batch_code: 'PB-20260731-001'
      },
      variant: {
        id: 2003,
        sku: 'BEE-RAW-1000',
        variant_name: '1kg Classic Jar'
      }
    }
  ]
})

function clonePreviewWorkspace() {
  return JSON.parse(JSON.stringify(previewWorkspace))
}

function throwIfError(error) {
  if (error) {
    throw error
  }
}

export function getPreviewRetailWorkspace() {
  return clonePreviewWorkspace()
}

export function formatRetailError(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error?.message === 'string' && error.message) {
    return error.message
  }

  return fallbackMessage
}

export async function fetchRetailWorkspace() {
  if (!supabase || !isSupabaseConfigured) {
    return clonePreviewWorkspace()
  }

  const [
    retailersResult,
    finishedStockResult,
    stockIssuesResult,
    retailerMovementsResult
  ] = await Promise.all([
    supabase
      .from('retailers')
      .select(
        `
          id,
          retailer_name,
          contact_name,
          phone,
          email,
          delivery_location,
          notes,
          is_active
        `
      )
      .eq('is_active', true)
      .order('retailer_name', { ascending: true }),
    supabase
      .from('production_outputs')
      .select(
        `
          id,
          quantity_produced,
          quantity_remaining,
          unit_cost,
          created_at,
          batch:production_batches (
            id,
            batch_code,
            started_at,
            completed_at,
            status
          ),
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
          )
        `
      )
      .gt('quantity_remaining', 0)
      .order('created_at', { ascending: true }),
    supabase
      .from('stock_issues')
      .select(
        `
          id,
          issue_reference,
          issued_at,
          status,
          total_quantity,
          total_cost,
          notes,
          retailer:retailers (
            id,
            retailer_name
          ),
          items:stock_issue_items (
            id,
            line_number,
            quantity_issued,
            unit_cost,
            total_cost,
            batch:production_batches (
              id,
              batch_code
            ),
            variant:product_variants (
              id,
              sku,
              variant_name
            )
          )
        `
      )
      .order('issued_at', { ascending: false })
      .limit(8),
    supabase
      .from('retailer_stock_ledgers')
      .select(
        `
          id,
          movement_type,
          quantity_delta,
          unit_cost,
          moved_at,
          notes,
          retailer:retailers (
            id,
            retailer_name
          ),
          batch:production_batches (
            id,
            batch_code
          ),
          variant:product_variants (
            id,
            sku,
            variant_name
          )
        `
      )
      .order('moved_at', { ascending: false })
  ])

  throwIfError(retailersResult.error)
  throwIfError(finishedStockResult.error)
  throwIfError(stockIssuesResult.error)
  throwIfError(retailerMovementsResult.error)

  return {
    mode: 'live',
    retailers: retailersResult.data ?? [],
    finishedStock: finishedStockResult.data ?? [],
    stockIssues: stockIssuesResult.data ?? [],
    retailerMovements: retailerMovementsResult.data ?? []
  }
}

export async function recordStockIssue(payload) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured yet. Add project keys before issuing stock.'
    )
  }

  const { data, error } = await supabase.rpc('record_stock_issue', {
    p_retailer_id: payload.retailerId,
    p_issued_at: payload.issuedAt,
    p_issue_reference: payload.issueReference,
    p_notes: payload.notes,
    p_items: payload.items
  })

  throwIfError(error)

  return data
}
