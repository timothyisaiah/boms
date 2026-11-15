// Accessibility smoke helpers. They inspect only visible headings, so closed
// dialogs and hidden tab panels do not count.
import { expect } from '@playwright/test'

/** Visible headings (h1–h6 and role="heading") in DOM order. */
export function headingOutline(page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, [role="heading"][aria-level]'
      )
    ]
      .filter(
        el =>
          el.checkVisibility({ visibilityProperty: true }) &&
          !el.closest('[aria-hidden="true"]')
      )
      .map(el => ({
        level: Number(el.getAttribute('aria-level') || el.tagName.slice(1)),
        text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)
      }))
  )
}

const formatOutline = outline =>
  outline.map(h => `  h${h.level} ${h.text}`).join('\n') || '  (no headings)'

/** Exactly one visible level-1 heading. */
export async function expectSingleH1(page) {
  const outline = await headingOutline(page)
  const h1s = outline.filter(h => h.level === 1)
  expect(
    h1s.length,
    `expected exactly one visible h1; outline:\n${formatOutline(outline)}`
  ).toBe(1)
}

/** The outline starts at h1 and never jumps more than one level deeper. */
export async function expectNoSkippedHeadingLevels(page) {
  const outline = await headingOutline(page)
  const skips = []
  let previous = 0
  for (const heading of outline) {
    if (heading.level > previous + 1)
      skips.push(`h${previous || '-'} → h${heading.level} "${heading.text}"`)
    previous = heading.level
  }
  expect(
    skips,
    `heading levels skipped:\n${skips.join('\n')}\noutline:\n${formatOutline(outline)}`
  ).toEqual([])
}

/** Emulate `prefers-reduced-motion: reduce` for the rest of the test. */
export async function emulateReducedMotion(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
}
