// Recipe defaults are rounded once to the consumption precision, with integer arithmetic.
export function recipeQuantity(perUnit, output) {
  const [whole, fraction = ''] = String(perUnit).split('.')
  const scaled =
    BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0').slice(0, 6))
  const milli = (scaled * BigInt(output) + 500n) / 1000n
  return `${milli / 1000n}.${String(milli % 1000n).padStart(3, '0')}`
}
