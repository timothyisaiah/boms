import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMovementType,
  formatQuantity,
  formatSignedQuantity,
  toIsoTimestamp
} from '../src/lib/format.js'
import {
  WORKSPACE_MODE,
  WORKSPACE_MODES,
  classifyWorkspaceError,
  useWorkspace
} from '../src/composables/useWorkspace.js'

// Reference implementations copied from the pages, to prove parity.
const pageMoney = value =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0)

test('formatters match the page helpers exactly', () => {
  for (const value of [0, 50000, '1234.6', null, undefined, 'abc', -20])
    assert.equal(formatMoney(value), pageMoney(value))
  assert.equal(formatQuantity('1234.5678'), '1,235')
  assert.equal(formatQuantity('1234.5678', 3), '1,234.568')
  assert.equal(formatSignedQuantity(5), '+5')
  assert.equal(formatSignedQuantity(-3), '-3')
  assert.equal(formatDate(null), 'No date')
  assert.equal(formatDateTime(''), 'No timestamp')
  const day = '2026-09-10T12:00:00.000Z'
  assert.equal(
    formatDate(day),
    new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
      new Date(day)
    )
  )
  assert.equal(toIsoTimestamp('2026-09-10'), day)
  assert.equal(toIsoTimestamp(''), null)
  assert.equal(formatMovementType('reconciliation_sale'), 'Reconciliation sale')
  assert.equal(formatMovementType('custom_value_here'), 'Custom Value Here')
})

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('workspace mode enum is exactly the four states', () => {
  assert.deepEqual([...WORKSPACE_MODES].sort(), [
    'live',
    'loading',
    'refreshing',
    'unavailable'
  ])
})

test('first load is loading, then live; refresh keeps data', async () => {
  let pending = deferred()
  const ws = useWorkspace(() => pending.promise, { immediate: false })
  assert.equal(ws.mode.value, WORKSPACE_MODE.LOADING)
  const first = ws.load()
  assert.equal(ws.mode.value, 'loading')
  pending.resolve({ rows: [1] })
  await first
  assert.equal(ws.mode.value, 'live')
  assert.deepEqual(ws.data.value, { rows: [1] })

  pending = deferred()
  const second = ws.refresh()
  assert.equal(ws.mode.value, 'refreshing')
  assert.deepEqual(ws.data.value, { rows: [1] })
  pending.reject(Object.assign(new Error('Boom'), { status: 503 }))
  await second
  assert.equal(ws.mode.value, 'unavailable')
  assert.equal(ws.isStale.value, true)
  assert.deepEqual(ws.data.value, { rows: [1] })
  assert.equal(ws.error.value.kind, 'server')
})

test('first-load failure is unavailable, never live', async () => {
  const ws = useWorkspace(
    () => Promise.reject(Object.assign(new Error('x'), { status: 401 })),
    { immediate: false, initialData: { rows: [] } }
  )
  await ws.load()
  assert.equal(ws.mode.value, 'unavailable')
  assert.equal(ws.hasData.value, false)
  assert.equal(ws.error.value.kind, 'unauthorized')
})

test('timeouts are distinguishable and abort the loader signal', async () => {
  let signal
  const ws = useWorkspace(
    ctx => {
      signal = ctx.signal
      return new Promise(() => {})
    },
    { immediate: false, timeoutMs: 10 }
  )
  await ws.load()
  assert.equal(ws.mode.value, 'unavailable')
  assert.equal(ws.error.value.kind, 'timeout')
  assert.equal(signal.aborted, true)
})

test('a superseded response is ignored', async () => {
  const slow = deferred()
  const fast = deferred()
  const queue = [slow, fast]
  const ws = useWorkspace(() => queue.shift().promise, { immediate: false })
  const first = ws.load()
  const second = ws.load()
  fast.resolve('new')
  await second
  slow.resolve('old')
  await first
  assert.equal(ws.data.value, 'new')
  assert.equal(ws.mode.value, 'live')
})

test('error classification', () => {
  assert.equal(classifyWorkspaceError({ status: 403 }).kind, 'forbidden')
  assert.equal(classifyWorkspaceError({ status: 500 }).kind, 'server')
  assert.equal(
    classifyWorkspaceError({ status: 0, message: 'Connection interrupted.' })
      .message,
    'Connection interrupted.'
  )
  assert.equal(classifyWorkspaceError({ status: 422 }).kind, 'request')
  assert.equal(classifyWorkspaceError({ name: 'TimeoutError' }).kind, 'timeout')
})
