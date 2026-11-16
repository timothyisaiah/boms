// Token audit for the global stylesheet (MF-13). Outside the `:root` token
// block, src/css/app.scss must take colours, radii and shadows from the
// `--boms-*` tokens and must not paint decorative gradients.
//
// Run: node --test tests/visual-tokens.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(
  new URL('../src/css/app.scss', import.meta.url),
  'utf8'
)

// Explicit exceptions: [selector-or-context substring, offending value].
// Each entry needs a comment saying why it cannot be a token. Keep it empty
// unless a value genuinely cannot live in :root.
const ALLOWLIST = []

/** Blank out comments (keeping line numbers) so prose cannot trip the audit. */
function stripComments(css) {
  const blank = match => match.replace(/[^\n]/g, ' ')
  return css
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(
      /(^|[^:'"])\/\/[^\n]*/g,
      (match, lead) => lead + blank(match.slice(lead.length))
    )
}

/** Remove top-level `:root { ... }` blocks (brace-matched), keeping lines. */
function stripRootBlocks(css) {
  let out = ''
  let index = 0
  const pattern = /(^|\n)\s*:root\s*\{/g
  let match
  while ((match = pattern.exec(css))) {
    const start = match.index + match[1].length
    let depth = 0
    let end = css.indexOf('{', start)
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++
      else if (css[end] === '}' && --depth === 0) break
    }
    out +=
      css.slice(index, start) + css.slice(start, end + 1).replace(/[^\n]/g, ' ')
    index = end + 1
    pattern.lastIndex = index
  }
  return out + css.slice(index)
}

const audited = stripRootBlocks(stripComments(source))
const lines = audited.split('\n')

function findAll(regex) {
  const hits = []
  lines.forEach((line, i) => {
    for (const match of line.matchAll(regex)) {
      const allowed = ALLOWLIST.some(
        ([context, value]) =>
          match[0].includes(value) && source.split('\n')[i].includes(context)
      )
      if (!allowed) hits.push(`app.scss:${i + 1}: ${line.trim()}`)
    }
  })
  return hits
}

test('the :root token block exists and was stripped', () => {
  assert.match(source, /:root\s*\{/)
  assert.doesNotMatch(audited, /--boms-color-canvas\s*:/)
})

test('no hard-coded colours outside :root', () => {
  const hits = [
    ...findAll(/#[0-9a-fA-F]{3,8}\b/g),
    ...findAll(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g)
  ]
  assert.deepEqual(hits, [], `Use a --boms-color-* token:\n${hits.join('\n')}`)
})

test('no gradients outside :root', () => {
  const hits = findAll(/\b(?:repeating-)?(?:linear|radial|conic)-gradient\(/g)
  assert.deepEqual(hits, [], `Routine surfaces are flat:\n${hits.join('\n')}`)
})

test('radii and shadows use tokens', () => {
  const radius = findAll(
    /border(?:-[a-z]+)*-radius\s*:(?!\s*(?:var\(--boms-radius-|inherit\s*;|0\s*;))/g
  )
  const shadow = findAll(/box-shadow\s*:(?!\s*var\(--boms-elevation-)/g)
  assert.deepEqual(
    [...radius, ...shadow],
    [],
    `Use --boms-radius-* / --boms-elevation-*:\n${[...radius, ...shadow].join('\n')}`
  )
})

test('the audit itself catches violations', () => {
  const sample = stripRootBlocks(
    stripComments(
      ':root {\n  --x: #fff;\n}\n.a {\n  color: #123456; // #abc\n  background: linear-gradient(red, blue);\n}\n'
    )
  )
  assert.doesNotMatch(sample, /#fff/)
  assert.doesNotMatch(sample, /#abc/)
  assert.match(sample, /#123456/)
  assert.match(sample, /linear-gradient\(/)
})
