// Shared display formatters.
//
// Each function is a byte-for-byte behavioural copy of the helpers currently
// duplicated in IndexPage, OperationsPage, RetailPage and FinancePage, so a
// page can switch to these imports without any visible change. Formatter
// instances are cached; the output is identical to constructing them per call.

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'UGX',
  maximumFractionDigits: 0
})
const quantityFormatters = new Map()
const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short'
})

/** Number(value) when finite, otherwise `fallback` (default 0). */
export function asNumber(value, fallback = 0) {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

/** "UGX 50,000" — whole shillings, non-numeric input renders as UGX 0. */
export function formatMoney(value) {
  return moneyFormatter.format(asNumber(value))
}

/**
 * Grouped quantity. Dashboard/Retail/Finance use whole units (default 0);
 * Operations material quantities use `formatQuantity(value, 3)`.
 */
export function formatQuantity(value, maximumFractionDigits = 0) {
  let formatter = quantityFormatters.get(maximumFractionDigits)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits })
    quantityFormatters.set(maximumFractionDigits, formatter)
  }
  return formatter.format(asNumber(value))
}

/** "+5" / "-3" / "0" (Retail movement quantities). */
export function formatSignedQuantity(value, maximumFractionDigits = 0) {
  const quantity = asNumber(value)
  const prefix = quantity > 0 ? '+' : ''
  return `${prefix}${formatQuantity(quantity, maximumFractionDigits)}`
}

/** "Sep 10, 2026"; empty input renders `fallback` ("No date"). */
export function formatDate(value, fallback = 'No date') {
  if (!value) return fallback
  return dateFormatter.format(new Date(value))
}

/** "Sep 10, 2026, 3:00 PM"; empty input renders `fallback` ("No timestamp"). */
export function formatDateTime(value, fallback = 'No timestamp') {
  if (!value) return fallback
  return dateTimeFormatter.format(new Date(value))
}

/** Today's business date in Kampala as YYYY-MM-DD (date input value). */
export function getTodayString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

/** Business date (YYYY-MM-DD) to the midday UTC timestamp the API expects. */
export function toIsoTimestamp(dateValue) {
  if (!dateValue) return null
  return `${dateValue}T12:00:00.000Z`
}

export function formatMaterialKind(value) {
  switch (value) {
    case 'raw_honey':
      return 'Raw honey'
    case 'spice':
      return 'Spice'
    default:
      return 'Packaging'
  }
}

export function formatSupplierKind(value) {
  switch (value) {
    case 'raw_honey':
      return 'Raw honey'
    case 'packaging':
      return 'Packaging'
    case 'spice':
      return 'Spice'
    default:
      return 'Mixed'
  }
}

export function formatMovementType(value) {
  switch (value) {
    case 'issue':
      return 'Stock issue'
    case 'return_to_warehouse':
      return 'Return to warehouse'
    case 'reconciliation_sale':
      return 'Reconciliation sale'
    case 'damage':
      return 'Damage'
    default:
      return value
        ?.split('_')
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ')
  }
}
