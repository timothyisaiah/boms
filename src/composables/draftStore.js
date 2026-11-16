// Pure, framework-free draft storage used by useFormDraft and auth sign-out.
// Every function takes the Storage-like object explicitly (getItem, setItem,
// removeItem, key, length) so the logic is unit-testable without a DOM.
//
// Drafts live under `boms:draft:<identity>:<formKey>`, deliberately separate
// from writes.js `boms:pending:<identity>:<action>` submissions: a draft holds
// form inputs only and never an idempotency key.

export const DRAFT_PREFIX = 'boms:draft:'
export const DEFAULT_DRAFT_EXPIRY_MS = 12 * 60 * 60 * 1000
const VERSION = 1

export function draftKey(identity, formKey) {
  return `${DRAFT_PREFIX}${identity}:${formKey}`
}

/** sessionStorage when available, otherwise null (private mode, SSR, node). */
export function defaultDraftStorage() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

/**
 * Deep copy of plain data minus anything that could be reused as a request
 * key: properties named like `idempotencyKey`/`Idempotency-Key`, and any
 * top-level property listed in `exclude`.
 */
export function sanitizeDraft(value, exclude = []) {
  const strip = (input, depth) => {
    if (Array.isArray(input)) return input.map(item => strip(item, depth + 1))
    if (!input || typeof input !== 'object') return input
    if (input instanceof Date) return input.toISOString()
    const output = {}
    for (const [key, entry] of Object.entries(input)) {
      if (/idempotency/i.test(key)) continue
      if (depth === 0 && exclude.includes(key)) continue
      if (typeof entry === 'function' || entry === undefined) continue
      output[key] = strip(entry, depth + 1)
    }
    return output
  }
  return strip(value, 0)
}

export function serializeDraft(value, exclude = []) {
  return JSON.stringify(sanitizeDraft(value, exclude))
}

function storageKeys(storage) {
  const keys = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key !== null) keys.push(key)
  }
  return keys
}

/** Persist a draft for `identity`. No identity -> nothing is stored. */
export function saveDraft(
  storage,
  identity,
  formKey,
  value,
  { exclude = [], now = Date.now() } = {}
) {
  if (!storage || !identity || !formKey) return false
  try {
    storage.setItem(
      draftKey(identity, formKey),
      JSON.stringify({
        v: VERSION,
        identity,
        savedAt: now,
        data: sanitizeDraft(value, exclude)
      })
    )
    return true
  } catch {
    // Quota or disabled storage: drafts are best effort.
    return false
  }
}

/**
 * Read a draft. Returns `{ data, savedAt }` or null. Expired, corrupt, or
 * foreign-identity entries are removed and return null.
 */
export function loadDraft(
  storage,
  identity,
  formKey,
  { expiryMs = DEFAULT_DRAFT_EXPIRY_MS, now = Date.now() } = {}
) {
  if (!storage || !identity || !formKey) return null
  const key = draftKey(identity, formKey)
  let entry
  try {
    entry = JSON.parse(storage.getItem(key) ?? 'null')
  } catch {
    entry = undefined
  }
  if (entry === null) return null
  const valid =
    entry &&
    entry.v === VERSION &&
    entry.identity === identity &&
    Number.isFinite(entry.savedAt) &&
    now - entry.savedAt <= expiryMs &&
    entry.savedAt <= now + 60000
  if (!valid) {
    removeDraft(storage, identity, formKey)
    return null
  }
  return { data: entry.data, savedAt: entry.savedAt }
}

export function removeDraft(storage, identity, formKey) {
  if (!storage || !identity || !formKey) return
  try {
    storage.removeItem(draftKey(identity, formKey))
  } catch {
    /* Storage unavailable: nothing to remove. */
  }
}

/** Remove every draft belonging to `identity` (sign-out). */
export function clearDraftsForIdentity(storage, identity) {
  if (!storage || !identity) return 0
  const prefix = `${DRAFT_PREFIX}${identity}:`
  let removed = 0
  try {
    for (const key of storageKeys(storage))
      if (key.startsWith(prefix)) {
        storage.removeItem(key)
        removed++
      }
  } catch {
    /* Storage unavailable. */
  }
  return removed
}

/**
 * Remove drafts that belong to anyone other than `identity` (another user
 * signed in on this tab) and, for `identity`, any that have expired.
 */
export function purgeDrafts(
  storage,
  identity,
  { expiryMs = DEFAULT_DRAFT_EXPIRY_MS, now = Date.now() } = {}
) {
  if (!storage) return 0
  const ownPrefix = identity ? `${DRAFT_PREFIX}${identity}:` : null
  let removed = 0
  try {
    for (const key of storageKeys(storage)) {
      if (!key.startsWith(DRAFT_PREFIX)) continue
      if (ownPrefix && key.startsWith(ownPrefix)) {
        const formKey = key.slice(ownPrefix.length)
        if (!loadDraft(storage, identity, formKey, { expiryMs, now })) removed++
        continue
      }
      storage.removeItem(key)
      removed++
    }
  } catch {
    /* Storage unavailable. */
  }
  return removed
}
