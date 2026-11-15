// Finance workflow rules shared by the finance form components.
//
// Everything here is a behaviour-preserving extraction of FinancePage.vue as
// it stood before the mobile-first refactor: the payload builders produce the
// same request bodies, and the validation helpers block submission under the
// same conditions. The reconciliation "accounted" rule mirrors the database
// check `quantity_sold + quantity_returned + quantity_damaged +
// quantity_expired + quantity_remaining = quantity_open`
// (neon/migrations/202609100002_security_and_decisions.sql and
// record_reconciliation in 202609100004_ported_writes.sql).
import { asNumber, formatQuantity, toIsoTimestamp } from '@/lib/format'

let lineKeySeed = 0

export function createLineKey(prefix = 'reconciliation') {
  lineKeySeed += 1
  return `${prefix}-${lineKeySeed}`
}

export function createReconciliationLine() {
  return {
    key: createLineKey('reconciliation'),
    stockIssueItemId: null,
    quantitySold: '',
    quantityReturned: '',
    quantityDamaged: '',
    quantityExpired: '',
    returnReason: '',
    quantityRemaining: ''
  }
}

/** Quantity inputs of a reconciliation line, in form order. */
export const RECONCILIATION_QUANTITIES = Object.freeze([
  { key: 'quantitySold', payload: 'quantity_sold', label: 'Sold' },
  { key: 'quantityReturned', payload: 'quantity_returned', label: 'Returned' },
  { key: 'quantityDamaged', payload: 'quantity_damaged', label: 'Damaged' },
  { key: 'quantityExpired', payload: 'quantity_expired', label: 'Expired' },
  {
    key: 'quantityRemaining',
    payload: 'quantity_remaining',
    label: 'Remaining'
  }
])

export function clearLineCounts(line) {
  line.quantitySold = ''
  line.quantityReturned = ''
  line.quantityDamaged = ''
  line.quantityExpired = ''
  line.returnReason = ''
  line.quantityRemaining = ''
}

/** Stable DOM id for one control of a line (QInput/QSelect `for`). */
export function lineFieldId(line, field) {
  return `reconciliation-${line.key}-${field}`
}

export function reconciliationLabel(reconciliation) {
  return (
    reconciliation.reconciliation_reference?.trim() ||
    `REC-${reconciliation.id}`
  )
}

export function remittanceLabel(remittance) {
  return remittance.remittance_reference?.trim() || `REMIT-${remittance.id}`
}

export function retailerOptionLabel(retailer) {
  return retailer.delivery_location
    ? `${retailer.retailer_name} / ${retailer.delivery_location}`
    : retailer.retailer_name
}

export function openLineOptionLabel(line) {
  return `${line.issue_reference ?? `ISSUE-${line.stock_issue_id}`} / ${line.sku ?? 'Variant'} / ${line.batch_code ?? 'Batch'} / ${formatQuantity(line.quantity_open)} jars open`
}

/** Price effective on the reconciliation date (read-only in the form). */
export function priceForOpenLine(pricing, openLine, reconciledOn) {
  if (!openLine) return null
  const at = toIsoTimestamp(reconciledOn)
  return (
    (pricing ?? []).find(
      price =>
        price.variant_id === openLine.variant_id &&
        Date.parse(price.effective_from) <= Date.parse(at)
    )?.unit_price ?? null
  )
}

/** One line exactly as it is posted (unchanged from the pre-refactor page). */
export function normalizeReconciliationItem(item) {
  return {
    stock_issue_item_id: item.stockIssueItemId,
    quantity_sold:
      item.quantitySold === ''
        ? Number.NaN
        : Math.trunc(asNumber(item.quantitySold)),
    quantity_returned:
      item.quantityReturned === ''
        ? 0
        : Math.trunc(asNumber(item.quantityReturned)),
    quantity_damaged:
      item.quantityDamaged === ''
        ? 0
        : Math.trunc(asNumber(item.quantityDamaged)),
    quantity_remaining:
      item.quantityRemaining === ''
        ? Number.NaN
        : Math.trunc(asNumber(item.quantityRemaining)),
    quantity_expired:
      item.quantityExpired === '' ? 0 : Number(item.quantityExpired),
    return_reason: item.returnReason
  }
}

export function buildReconciliationPayload(form) {
  return {
    retailerId: form.retailerId,
    reconciledAt: toIsoTimestamp(form.reconciledOn),
    reconciliationReference: form.reconciliationReference,
    notes: form.notes,
    items: form.items.map(normalizeReconciliationItem)
  }
}

export function buildRemittancePayload(form) {
  return {
    retailerId: form.retailerId,
    reconciliationId: form.reconciliationId,
    receivedAt: toIsoTimestamp(form.receivedOn),
    amount: asNumber(form.amount, Number.NaN),
    remittanceReference: form.remittanceReference,
    notes: form.notes
  }
}

export function buildExpensePayload(form) {
  return {
    expenseCategory: form.expenseCategory,
    incurredAt: toIsoTimestamp(form.incurredOn),
    amount: asNumber(form.amount, Number.NaN),
    vendorName: form.vendorName,
    expenseReference: form.expenseReference,
    notes: form.notes
  }
}

function isIncomplete(item) {
  return (
    !item.stock_issue_item_id ||
    !Number.isFinite(item.quantity_sold) ||
    !Number.isFinite(item.quantity_returned) ||
    !Number.isFinite(item.quantity_damaged) ||
    !Number.isFinite(item.quantity_remaining) ||
    item.quantity_sold < 0 ||
    item.quantity_returned < 0 ||
    item.quantity_damaged < 0 ||
    item.quantity_remaining < 0 ||
    !Number.isInteger(item.quantity_expired) ||
    item.quantity_expired < 0
  )
}

/**
 * Live accounting for one line, for display only. Blank counts count as 0
 * here; the submit check still requires Sold and Remaining.
 *
 * - opening:     jars still open on the issued line (`quantity_open`)
 * - accounted:   sold + returned + damaged + expired + remaining
 * - unaccounted: opening - accounted (negative = counted more than is open)
 * - state:       'unselected' | 'unknown' (line no longer open) |
 *                'under' | 'over' | 'balanced'
 */
export function lineAccounting(line, openLine) {
  if (!line.stockIssueItemId)
    return {
      state: 'unselected',
      opening: null,
      accounted: 0,
      unaccounted: null
    }
  const item = normalizeReconciliationItem(line)
  const accounted = RECONCILIATION_QUANTITIES.reduce((total, field) => {
    const value = item[field.payload]
    return total + (Number.isFinite(value) ? value : 0)
  }, 0)
  if (!openLine)
    return { state: 'unknown', opening: null, accounted, unaccounted: null }
  const opening = Math.trunc(asNumber(openLine.quantity_open))
  const unaccounted = opening - accounted
  return {
    state: unaccounted > 0 ? 'under' : unaccounted < 0 ? 'over' : 'balanced',
    opening,
    accounted,
    unaccounted
  }
}

/** Plain-language description of a line's accounting state. */
export function describeAccounting(accounting) {
  const jars = value =>
    `${formatQuantity(Math.abs(value))} ${Math.abs(value) === 1 ? 'jar' : 'jars'}`
  switch (accounting.state) {
    case 'under':
      return `${jars(accounting.unaccounted)} unaccounted. Count where the rest of the ${jars(accounting.opening)} went.`
    case 'over':
      return `Over by ${jars(accounting.unaccounted)}. The counts add up to more than the ${jars(accounting.opening)} open.`
    case 'balanced':
      return `All ${jars(accounting.opening)} accounted for.`
    case 'unknown':
      return 'This stock line is no longer open. Choose another line or remove it.'
    default:
      return 'Choose an issued stock line to start counting.'
  }
}

/**
 * Submit checks for a reconciliation. Blocks under exactly the conditions
 * the page used before (retailer, complete lines, no duplicate lines, lines
 * still open for the retailer, every line fully accounted) but reports every
 * offending line instead of the first one.
 *
 * @returns {Array<{ id: string, label: string, message: string }>}
 */
export function validateReconciliation(form, resolveOpenLine) {
  if (!form.retailerId)
    return [
      {
        id: 'reconciliation-retailer',
        label: 'Retail partner',
        message: 'Select a retailer before recording a reconciliation.'
      }
    ]

  const lines = form.items.map((line, index) => ({
    line,
    index,
    item: normalizeReconciliationItem(line)
  }))
  const label = index => `Line ${index + 1}`

  const incomplete = lines.filter(({ item }) => isIncomplete(item))
  if (incomplete.length)
    return incomplete.map(({ line, index, item }) => {
      const field = !item.stock_issue_item_id
        ? 'line'
        : (RECONCILIATION_QUANTITIES.find(quantity => {
            const value = item[quantity.payload]
            return (
              !Number.isFinite(value) ||
              value < 0 ||
              (quantity.payload === 'quantity_expired' &&
                !Number.isInteger(value))
            )
          })?.key ?? 'quantitySold')
      return {
        id: lineFieldId(line, field),
        label: label(index),
        message:
          'Complete every reconciliation line with a stock line and non-negative whole quantities.'
      }
    })

  const seen = new Set()
  const duplicates = []
  for (const { line, index, item } of lines) {
    if (seen.has(item.stock_issue_item_id))
      duplicates.push({
        id: lineFieldId(line, 'line'),
        label: label(index),
        message:
          'Each issued stock line can only appear once in a reconciliation.'
      })
    seen.add(item.stock_issue_item_id)
  }
  if (duplicates.length) return duplicates

  const errors = []
  for (const { line, index, item } of lines) {
    const openLine = resolveOpenLine(item.stock_issue_item_id)
    if (!openLine || openLine.retailer_id !== form.retailerId) {
      errors.push({
        id: lineFieldId(line, 'line'),
        label: label(index),
        message: 'This stock line is no longer open for the selected retailer.'
      })
      continue
    }
    const accounting = lineAccounting(line, openLine)
    if (accounting.accounted !== accounting.opening)
      errors.push({
        id: lineFieldId(line, 'quantitySold'),
        label: label(index),
        message: `Each line must fully explain the retailer stock currently on hand. ${describeAccounting(accounting)}`
      })
  }
  return errors
}

export function validateRemittance(form) {
  const errors = []
  if (!form.retailerId)
    return [
      {
        id: 'remittance-retailer',
        label: 'Retail partner',
        message: 'Select a retailer before recording a remittance.'
      }
    ]
  const amount = asNumber(form.amount, Number.NaN)
  if (!Number.isFinite(amount) || amount <= 0)
    errors.push({
      id: 'remittance-amount',
      label: 'Amount remitted',
      message: 'Enter a remittance amount greater than zero.'
    })
  return errors
}

export function validateExpense(form) {
  if (!form.expenseCategory.trim())
    return [
      {
        id: 'expense-category',
        label: 'Expense category',
        message: 'Enter an expense category before saving the cost.'
      }
    ]
  const amount = asNumber(form.amount, Number.NaN)
  if (!Number.isFinite(amount) || amount <= 0)
    return [
      {
        id: 'expense-amount',
        label: 'Expense amount',
        message: 'Enter an expense amount greater than zero.'
      }
    ]
  return []
}

export function getRetailerBalanceState(balance) {
  if (asNumber(balance.outstanding_amount) > 0)
    return { label: 'Outstanding', tone: 'warning' }
  if (asNumber(balance.outstanding_amount) < 0)
    return { label: 'Retailer credit', tone: 'info' }
  if (asNumber(balance.remaining_quantity) > 0)
    return { label: 'Stock on hand', tone: 'success' }
  return { label: 'Settled', tone: 'neutral' }
}
