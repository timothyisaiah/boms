// Status vocabulary: tones, labels and exception ordering (src/lib/status.js).
// Run: node --test tests/status.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  RETAILER_STATUS,
  STATUS_TONES,
  isStatusTone,
  netResultStatus,
  normalizeTone,
  retailerBalanceStatus,
  sortByException,
  statusChipClass
} from '../src/lib/status.js'

const root = fileURLToPath(new URL('..', import.meta.url))

test('exactly the five status-chip tones exist', () => {
  assert.deepEqual(
    [...STATUS_TONES],
    ['neutral', 'success', 'info', 'warning', 'danger']
  )
  assert.ok(Object.isFrozen(STATUS_TONES))
})

test('unknown tones fall back to neutral', () => {
  for (const tone of STATUS_TONES) assert.equal(normalizeTone(tone), tone)
  for (const tone of [undefined, null, '', 'positive', 'negative', 'Warning'])
    assert.equal(normalizeTone(tone), 'neutral')
  assert.equal(isStatusTone('error'), false)
})

test('statusChipClass keeps the app.scss class contract', () => {
  assert.deepEqual(statusChipClass('warning'), [
    'status-chip',
    'status-chip--warning'
  ])
  assert.deepEqual(statusChipClass('bogus'), [
    'status-chip',
    'status-chip--neutral'
  ])
})

test('retailer balance states', () => {
  const cases = [
    [{ outstanding_amount: '50000', remaining_quantity: 12 }, 'Payment due'],
    [{ outstanding_amount: 1, remaining_quantity: 0 }, 'Payment due'],
    [{ outstanding_amount: -2500, remaining_quantity: 4 }, 'Credit'],
    [{ outstanding_amount: 0, remaining_quantity: '3' }, 'In store'],
    [{ outstanding_amount: null, remaining_quantity: null }, 'Settled'],
    [{}, 'Settled'],
    [undefined, 'Settled']
  ]
  for (const [balance, label] of cases)
    assert.equal(retailerBalanceStatus(balance).label, label)
  assert.equal(retailerBalanceStatus({ outstanding_amount: 5 }).tone, 'warning')
  assert.equal(retailerBalanceStatus({ outstanding_amount: -5 }).tone, 'info')
  assert.equal(retailerBalanceStatus({ remaining_quantity: 5 }).tone, 'success')
  assert.equal(retailerBalanceStatus({}).tone, 'neutral')
})

test('net result: loss is danger, break-even or better is success', () => {
  assert.deepEqual(netResultStatus(-1), { label: 'Loss', tone: 'danger' })
  assert.deepEqual(netResultStatus(0), { label: 'Profit', tone: 'success' })
  assert.deepEqual(netResultStatus('1500'), {
    label: 'Profit',
    tone: 'success'
  })
  assert.deepEqual(netResultStatus(null), { label: 'Profit', tone: 'success' })
})

// Approved StatusBadge vocabulary (docs/audits/design-system.md) plus the
// retailer states this module defines; none is an action verb.
const VERB_LABELS = /^(collect|pay|review|follow up|reconcile|issue|record)\b/i

test('status labels are states with text, never verbs', () => {
  const statuses = [
    ...Object.values(RETAILER_STATUS),
    netResultStatus(-1),
    netResultStatus(1)
  ]
  for (const status of statuses) {
    assert.ok(isStatusTone(status.tone), `${status.label} tone`)
    assert.ok(status.label.trim().length > 0, 'status has visible text')
    assert.doesNotMatch(status.label, VERB_LABELS)
  }
})

test('sortByException moves danger then warning first, stably', () => {
  const items = [
    { label: 'a' },
    { label: 'b', tone: 'warning' },
    { label: 'c', tone: 'success' },
    { label: 'd', tone: 'danger' },
    { label: 'e', tone: 'warning' },
    { label: 'f', tone: null }
  ]
  assert.deepEqual(
    sortByException(items).map(item => item.label),
    ['d', 'b', 'e', 'a', 'c', 'f']
  )
  // No exceptions: authored order is kept and the input is not mutated.
  const calm = [{ label: 'x' }, { label: 'y', tone: 'info' }, { label: 'z' }]
  assert.deepEqual(
    sortByException(calm).map(item => item.label),
    ['x', 'y', 'z']
  )
  assert.equal(items[0].label, 'a')
})

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(vue|js)$/.test(name) ? [path] : []
  })
}

test('every status-chip modifier and literal tone in src is one of the five', () => {
  const offenders = []
  for (const file of sourceFiles(join(root, 'src'))) {
    const text = readFileSync(file, 'utf8')
    for (const [, tone] of text.matchAll(/status-chip--([a-z]+)/g))
      if (!isStatusTone(tone))
        offenders.push(`${relative(root, file)}: ${tone}`)
    for (const [, tone] of text.matchAll(/\btone:\s*'([a-z]+)'/g))
      if (!isStatusTone(tone))
        offenders.push(`${relative(root, file)}: ${tone}`)
  }
  assert.deepEqual(offenders, [])
})
