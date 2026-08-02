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
  openIssueLines: [
    {
      retailer_id: 5001,
      retailer_name: 'Ntinda Health Market',
      delivery_location: 'Ntinda, Kampala',
      stock_issue_id: 8001,
      stock_issue_item_id: 8101,
      issue_reference: 'DN-NTI-0004',
      issued_at: '2026-08-01T14:00:00.000Z',
      production_output_id: 7001,
      production_batch_id: 6001,
      batch_code: 'PB-20260729-001',
      variant_id: 2002,
      sku: 'BEE-RAW-500',
      variant_name: '500g Classic Jar',
      original_quantity_issued: 42,
      quantity_open: 25,
      unit_cost: 16850,
      open_stock_value: 421250
    },
    {
      retailer_id: 5002,
      retailer_name: 'Entebbe Organics Corner',
      delivery_location: 'Entebbe Road, Wakiso',
      stock_issue_id: 8002,
      stock_issue_item_id: 8102,
      issue_reference: 'DN-ENT-0002',
      issued_at: '2026-08-01T16:15:00.000Z',
      production_output_id: 7002,
      production_batch_id: 6002,
      batch_code: 'PB-20260731-001',
      variant_id: 2003,
      sku: 'BEE-RAW-1000',
      variant_name: '1kg Classic Jar',
      original_quantity_issued: 54,
      quantity_open: 54,
      unit_cost: 30200,
      open_stock_value: 1630800
    }
  ],
  reconciliations: [
    {
      id: 9501,
      reconciliation_reference: 'REC-NTI-20260802',
      reconciled_at: '2026-08-02T15:00:00.000Z',
      total_open_quantity: 42,
      total_sold_quantity: 12,
      total_returned_quantity: 3,
      total_damaged_quantity: 2,
      total_remaining_quantity: 25,
      total_sales_value: 336000,
      total_returned_value: 84000,
      total_damaged_value: 56000,
      total_remaining_value: 700000,
      total_cogs_value: 202200,
      notes: 'Weekend count after shelf promotion.',
      retailer: {
        id: 5001,
        retailer_name: 'Ntinda Health Market'
      },
      items: [
        {
          id: 9601,
          line_number: 1,
          stock_issue_item_id: 8101,
          quantity_open: 42,
          quantity_sold: 12,
          quantity_returned: 3,
          quantity_damaged: 2,
          quantity_remaining: 25,
          unit_cost: 16850,
          unit_price: 28000,
          sales_value: 336000,
          returned_value: 84000,
          damaged_value: 56000,
          remaining_value: 700000,
          cogs_value: 202200,
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
  remittances: [
    {
      id: 9701,
      amount: 250000,
      remittance_reference: 'MMT-772418',
      received_at: '2026-08-02T16:30:00.000Z',
      notes: 'First mobile money transfer after the visit.',
      retailer: {
        id: 5001,
        retailer_name: 'Ntinda Health Market'
      },
      reconciliation: {
        id: 9501,
        reconciliation_reference: 'REC-NTI-20260802',
        reconciled_at: '2026-08-02T15:00:00.000Z'
      }
    }
  ],
  expenses: [
    {
      id: 9801,
      expense_category: 'Delivery fuel',
      incurred_at: '2026-08-02T09:00:00.000Z',
      amount: 185000,
      vendor_name: 'Shell Ntinda',
      expense_reference: 'FUEL-20418',
      notes: 'Retail distribution route covering Ntinda and Bukoto.'
    },
    {
      id: 9802,
      expense_category: 'Promoter stipend',
      incurred_at: '2026-08-02T10:00:00.000Z',
      amount: 120000,
      vendor_name: 'Field Team',
      expense_reference: 'PROMO-082',
      notes: 'Weekend in-store activation support.'
    }
  ],
  retailerBalances: [
    {
      retailer_id: 5001,
      retailer_name: 'Ntinda Health Market',
      delivery_location: 'Ntinda, Kampala',
      issued_quantity: 42,
      reconciliation_count: 1,
      remittance_count: 1,
      sold_quantity: 12,
      returned_quantity: 3,
      damaged_quantity: 2,
      remaining_quantity: 25,
      recognized_sales_value: 336000,
      cost_of_goods_sold: 202200,
      gross_profit: 133800,
      remitted_amount: 250000,
      outstanding_amount: 86000,
      last_reconciled_at: '2026-08-02T15:00:00.000Z',
      last_remitted_at: '2026-08-02T16:30:00.000Z'
    },
    {
      retailer_id: 5002,
      retailer_name: 'Entebbe Organics Corner',
      delivery_location: 'Entebbe Road, Wakiso',
      issued_quantity: 54,
      reconciliation_count: 0,
      remittance_count: 0,
      sold_quantity: 0,
      returned_quantity: 0,
      damaged_quantity: 0,
      remaining_quantity: 54,
      recognized_sales_value: 0,
      cost_of_goods_sold: 0,
      gross_profit: 0,
      remitted_amount: 0,
      outstanding_amount: 0,
      last_reconciled_at: null,
      last_remitted_at: null
    },
    {
      retailer_id: 5003,
      retailer_name: 'Jinja Farmers Shop',
      delivery_location: 'Jinja Main Street',
      issued_quantity: 0,
      reconciliation_count: 0,
      remittance_count: 0,
      sold_quantity: 0,
      returned_quantity: 0,
      damaged_quantity: 0,
      remaining_quantity: 0,
      recognized_sales_value: 0,
      cost_of_goods_sold: 0,
      gross_profit: 0,
      remitted_amount: 0,
      outstanding_amount: 0,
      last_reconciled_at: null,
      last_remitted_at: null
    }
  ],
  profitSummary: {
    active_retailers: 2,
    issued_quantity: 96,
    sold_quantity: 12,
    returned_quantity: 3,
    damaged_quantity: 2,
    remaining_quantity: 79,
    recognized_sales_value: 336000,
    cost_of_goods_sold: 202200,
    gross_profit: 133800,
    expense_count: 2,
    operating_expenses: 305000,
    net_profit: -171200,
    remitted_amount: 250000,
    outstanding_amount: 86000
  }
})

function clonePreviewWorkspace() {
  return JSON.parse(JSON.stringify(previewWorkspace))
}

function throwIfError(error) {
  if (error) {
    throw error
  }
}

export function getPreviewFinanceWorkspace() {
  return clonePreviewWorkspace()
}

export function formatFinanceError(error, fallbackMessage) {
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

export async function fetchFinanceWorkspace() {
  if (!supabase || !isSupabaseConfigured) {
    return clonePreviewWorkspace()
  }

  const [
    retailersResult,
    openIssueLinesResult,
    reconciliationsResult,
    remittancesResult,
    expensesResult,
    retailerBalancesResult,
    profitSummaryResult
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
      .from('retailer_issue_open_balances')
      .select(
        `
          retailer_id,
          retailer_name,
          delivery_location,
          stock_issue_id,
          stock_issue_item_id,
          issue_reference,
          issued_at,
          production_output_id,
          production_batch_id,
          batch_code,
          variant_id,
          sku,
          variant_name,
          original_quantity_issued,
          quantity_open,
          unit_cost,
          open_stock_value
        `
      )
      .order('issued_at', { ascending: true }),
    supabase
      .from('reconciliations')
      .select(
        `
          id,
          reconciliation_reference,
          reconciled_at,
          total_open_quantity,
          total_sold_quantity,
          total_returned_quantity,
          total_damaged_quantity,
          total_remaining_quantity,
          total_sales_value,
          total_returned_value,
          total_damaged_value,
          total_remaining_value,
          total_cogs_value,
          notes,
          retailer:retailers (
            id,
            retailer_name
          ),
          items:reconciliation_items (
            id,
            line_number,
            stock_issue_item_id,
            quantity_open,
            quantity_sold,
            quantity_returned,
            quantity_damaged,
            quantity_remaining,
            unit_cost,
            unit_price,
            sales_value,
            returned_value,
            damaged_value,
            remaining_value,
            cogs_value,
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
      .order('reconciled_at', { ascending: false })
      .limit(8),
    supabase
      .from('remittances')
      .select(
        `
          id,
          amount,
          remittance_reference,
          received_at,
          notes,
          retailer:retailers (
            id,
            retailer_name
          ),
          reconciliation:reconciliations (
            id,
            reconciliation_reference,
            reconciled_at
          )
        `
      )
      .order('received_at', { ascending: false })
      .limit(10),
    supabase
      .from('expenses')
      .select(
        `
          id,
          expense_category,
          incurred_at,
          amount,
          vendor_name,
          expense_reference,
          notes
        `
      )
      .order('incurred_at', { ascending: false })
      .limit(10),
    supabase
      .from('retailer_outstanding_balances')
      .select(
        `
          retailer_id,
          retailer_name,
          delivery_location,
          issued_quantity,
          reconciliation_count,
          remittance_count,
          sold_quantity,
          returned_quantity,
          damaged_quantity,
          remaining_quantity,
          recognized_sales_value,
          cost_of_goods_sold,
          gross_profit,
          remitted_amount,
          outstanding_amount,
          last_reconciled_at,
          last_remitted_at
        `
      )
      .order('outstanding_amount', { ascending: false })
      .order('retailer_name', { ascending: true }),
    supabase.from('finance_profit_summary').select('*').single()
  ])

  throwIfError(retailersResult.error)
  throwIfError(openIssueLinesResult.error)
  throwIfError(reconciliationsResult.error)
  throwIfError(remittancesResult.error)
  throwIfError(expensesResult.error)
  throwIfError(retailerBalancesResult.error)
  throwIfError(profitSummaryResult.error)

  return {
    mode: 'live',
    retailers: retailersResult.data ?? [],
    openIssueLines: openIssueLinesResult.data ?? [],
    reconciliations: reconciliationsResult.data ?? [],
    remittances: remittancesResult.data ?? [],
    expenses: expensesResult.data ?? [],
    retailerBalances: retailerBalancesResult.data ?? [],
    profitSummary: profitSummaryResult.data ?? {
      active_retailers: 0,
      issued_quantity: 0,
      sold_quantity: 0,
      returned_quantity: 0,
      damaged_quantity: 0,
      remaining_quantity: 0,
      recognized_sales_value: 0,
      cost_of_goods_sold: 0,
      gross_profit: 0,
      expense_count: 0,
      operating_expenses: 0,
      net_profit: 0,
      remitted_amount: 0,
      outstanding_amount: 0
    }
  }
}

export async function recordRetailReconciliation(payload) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured yet. Add project keys before recording reconciliations.'
    )
  }

  const { data, error } = await supabase.rpc('record_reconciliation', {
    p_retailer_id: payload.retailerId,
    p_reconciled_at: payload.reconciledAt,
    p_reconciliation_reference: payload.reconciliationReference,
    p_notes: payload.notes,
    p_items: payload.items
  })

  throwIfError(error)

  return data
}

export async function recordRetailRemittance(payload) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured yet. Add project keys before recording remittances.'
    )
  }

  const { data, error } = await supabase.rpc('record_remittance', {
    p_retailer_id: payload.retailerId,
    p_reconciliation_id: payload.reconciliationId,
    p_received_at: payload.receivedAt,
    p_amount: payload.amount,
    p_remittance_reference: payload.remittanceReference,
    p_notes: payload.notes
  })

  throwIfError(error)

  return data
}

export async function recordOperatingExpense(payload) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured yet. Add project keys before recording expenses.'
    )
  }

  const { data, error } = await supabase.rpc('record_expense', {
    p_expense_category: payload.expenseCategory,
    p_incurred_at: payload.incurredAt,
    p_amount: payload.amount,
    p_vendor_name: payload.vendorName,
    p_expense_reference: payload.expenseReference,
    p_notes: payload.notes
  })

  throwIfError(error)

  return data
}
