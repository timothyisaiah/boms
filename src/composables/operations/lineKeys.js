let lineKeySeed = 0

/** Unique key for a repeatable form line (receipt items, batch inputs). */
export function createLineKey(prefix) {
  lineKeySeed += 1
  return `${prefix}-${lineKeySeed}`
}

/** Replace the contents of a reactive array in place. */
export function resetArray(target, nextItems) {
  target.splice(0, target.length, ...nextItems)
}
