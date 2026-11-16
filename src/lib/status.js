// Status vocabulary shared by every `.status-chip` and toned metric.
//
// Tones map one-to-one onto the `status-chip--{tone}` classes in app.scss.
// Labels are states or nouns ("Payment due", "In store"), never action verbs,
// and a status is always rendered with its text so colour is never the only
// cue (docs/audits/design-system.md, StatusBadge).
import { asNumber } from './format.js'

export const STATUS_TONES = Object.freeze([
  'neutral',
  'success',
  'info',
  'warning',
  'danger'
])

/** Exceptions sort first in metric strips: danger, then warning. */
const TONE_PRIORITY = Object.freeze({
  danger: 0,
  warning: 1,
  info: 2,
  success: 2,
  neutral: 2
})

export function isStatusTone(tone) {
  return STATUS_TONES.includes(tone)
}

/** Any unknown or missing tone falls back to `neutral`. */
export function normalizeTone(tone) {
  return isStatusTone(tone) ? tone : 'neutral'
}

/** Class list for a status chip: `['status-chip', 'status-chip--{tone}']`. */
export function statusChipClass(tone) {
  return ['status-chip', `status-chip--${normalizeTone(tone)}`]
}

export function tonePriority(tone) {
  return TONE_PRIORITY[normalizeTone(tone)]
}

/**
 * Stable sort that moves exception metrics (danger, warning) ahead of the
 * rest while keeping the authored order inside each group.
 */
export function sortByException(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        tonePriority(a.item.tone) - tonePriority(b.item.tone) ||
        a.index - b.index
    )
    .map(({ item }) => item)
}

export const RETAILER_STATUS = Object.freeze({
  paymentDue: Object.freeze({ label: 'Payment due', tone: 'warning' }),
  credit: Object.freeze({ label: 'Credit', tone: 'info' }),
  inStore: Object.freeze({ label: 'In store', tone: 'success' }),
  settled: Object.freeze({ label: 'Settled', tone: 'neutral' })
})

/**
 * One retailer balance state for the dashboard watchlist and the finance
 * snapshot. Reads `outstanding_amount` and `remaining_quantity`.
 */
export function retailerBalanceStatus(balance = {}) {
  const outstanding = asNumber(balance.outstanding_amount)
  if (outstanding > 0) return RETAILER_STATUS.paymentDue
  if (outstanding < 0) return RETAILER_STATUS.credit
  if (asNumber(balance.remaining_quantity) > 0) return RETAILER_STATUS.inStore
  return RETAILER_STATUS.settled
}

/** Net result: a loss is a danger state, break-even or better is success. */
export function netResultStatus(netProfit) {
  return asNumber(netProfit) < 0
    ? { label: 'Loss', tone: 'danger' }
    : { label: 'Profit', tone: 'success' }
}
