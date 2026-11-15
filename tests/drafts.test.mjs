import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_DRAFT_EXPIRY_MS,
  clearDraftsForIdentity,
  draftKey,
  loadDraft,
  purgeDrafts,
  removeDraft,
  sanitizeDraft,
  saveDraft
} from '../src/composables/draftStore.js'

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    key: index => [...map.keys()][index] ?? null,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    keys: () => [...map.keys()]
  }
}

const alice = 'user-alice'
const bob = 'user-bob'
const form = {
  retailerId: 4,
  lines: [{ key: 'reconciliation-1', quantitySold: '3', idempotencyKey: 'x' }],
  'Idempotency-Key': 'abc',
  note: 'counted at 10am'
}

test('saves and restores a draft for the same user', () => {
  const storage = memoryStorage()
  assert.equal(
    saveDraft(storage, alice, 'finance:rec', form, { now: 1000 }),
    true
  )
  const draft = loadDraft(storage, alice, 'finance:rec', { now: 2000 })
  assert.equal(draft.savedAt, 1000)
  assert.equal(draft.data.retailerId, 4)
  assert.equal(draft.data.lines[0].quantitySold, '3')
})

test('never stores idempotency keys, at any depth', () => {
  const storage = memoryStorage()
  saveDraft(storage, alice, 'finance:rec', form)
  const raw = storage.getItem(draftKey(alice, 'finance:rec'))
  assert.doesNotMatch(raw, /idempotency/i)
  assert.doesNotMatch(raw, /"abc"/)
  const pendingWrites = storage
    .keys()
    .filter(key => key.startsWith('boms:pending:'))
  assert.deepEqual(pendingWrites, [])
})

test('honours top-level exclude', () => {
  const clean = sanitizeDraft({ a: 1, secret: 2, nested: { secret: 3 } }, [
    'secret'
  ])
  assert.deepEqual(clean, { a: 1, nested: { secret: 3 } })
})

test('another user cannot read the draft', () => {
  const storage = memoryStorage()
  saveDraft(storage, alice, 'finance:rec', form)
  assert.equal(loadDraft(storage, bob, 'finance:rec'), null)
  assert.ok(loadDraft(storage, alice, 'finance:rec'))
})

test('a tampered entry with a foreign identity is rejected and removed', () => {
  const storage = memoryStorage()
  storage.setItem(
    draftKey(alice, 'finance:rec'),
    JSON.stringify({ v: 1, identity: bob, savedAt: Date.now(), data: {} })
  )
  assert.equal(loadDraft(storage, alice, 'finance:rec'), null)
  assert.equal(storage.length, 0)
})

test('expires after expiryMs (default 12 hours) and removes the entry', () => {
  const storage = memoryStorage()
  saveDraft(storage, alice, 'f', form, { now: 0 })
  assert.ok(loadDraft(storage, alice, 'f', { now: DEFAULT_DRAFT_EXPIRY_MS }))
  assert.equal(
    loadDraft(storage, alice, 'f', { now: DEFAULT_DRAFT_EXPIRY_MS + 1 }),
    null
  )
  assert.equal(storage.length, 0)
  saveDraft(storage, alice, 'g', form, { now: 0 })
  assert.equal(loadDraft(storage, alice, 'g', { now: 61, expiryMs: 60 }), null)
})

test('corrupt JSON is discarded', () => {
  const storage = memoryStorage({ [draftKey(alice, 'f')]: '{not json' })
  assert.equal(loadDraft(storage, alice, 'f'), null)
  assert.equal(storage.length, 0)
})

test('no identity means nothing is stored or read', () => {
  const storage = memoryStorage()
  assert.equal(saveDraft(storage, '', 'f', form), false)
  assert.equal(storage.length, 0)
  assert.equal(loadDraft(storage, '', 'f'), null)
})

test('removeDraft and clearDraftsForIdentity only touch that user drafts', () => {
  const storage = memoryStorage({ 'boms:pending:user-alice:expenses': '{}' })
  saveDraft(storage, alice, 'a', form)
  saveDraft(storage, alice, 'b', form)
  saveDraft(storage, bob, 'a', form)
  removeDraft(storage, alice, 'a')
  assert.equal(loadDraft(storage, alice, 'a'), null)
  assert.equal(clearDraftsForIdentity(storage, alice), 1)
  assert.deepEqual(storage.keys().sort(), [
    draftKey(bob, 'a'),
    'boms:pending:user-alice:expenses'
  ])
})

test('purgeDrafts removes other users and expired own drafts', () => {
  const storage = memoryStorage({ unrelated: '1' })
  saveDraft(storage, alice, 'old', form, { now: 0 })
  saveDraft(storage, alice, 'fresh', form, {
    now: DEFAULT_DRAFT_EXPIRY_MS
  })
  saveDraft(storage, bob, 'x', form, { now: DEFAULT_DRAFT_EXPIRY_MS })
  purgeDrafts(storage, alice, { now: DEFAULT_DRAFT_EXPIRY_MS + 10 })
  assert.deepEqual(storage.keys().sort(), [
    draftKey(alice, 'fresh'),
    'unrelated'
  ])
})

test('storage failures are swallowed', () => {
  const broken = {
    length: 0,
    key: () => null,
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {
      throw new Error('quota')
    },
    removeItem: () => {
      throw new Error('denied')
    }
  }
  assert.equal(saveDraft(broken, alice, 'f', form), false)
  assert.equal(loadDraft(broken, alice, 'f'), null)
  assert.equal(saveDraft(null, alice, 'f', form), false)
})
