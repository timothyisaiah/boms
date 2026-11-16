// Navigation, viewport and layout helpers shared by browser specs.
import { expect } from '@playwright/test'
import { ALL_ROUTES } from './routes.js'

/** The six reference widths from the responsive design strategy. */
export const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 }
]

/** Widths the original mobile.spec covered, kept so coverage never shrinks. */
export const LEGACY_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 844 }
]

/** Modes during which a `[data-workspace-mode]` element is not settled. */
export const UNSETTLED_WORKSPACE_MODES = ['loading', 'refreshing']

const hashPath = url => new URL(url).hash.replace(/^#/, '').split('?')[0] || '/'

const matchesHeading = (heading, text) =>
  typeof heading === 'string' ? text === heading : heading.test(text)

/** Text of every visible h1, in DOM order. */
export function visibleH1Texts(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('h1, [role="heading"][aria-level="1"]')]
      .filter(el => el.checkVisibility({ visibilityProperty: true }))
      .map(el => el.textContent.replace(/\s+/g, ' ').trim())
  )
}

/** Values of every rendered `data-workspace-mode` attribute. */
export function workspaceModes(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-workspace-mode]')].map(
      el => el.dataset.workspaceMode
    )
  )
}

/** Resolve after web fonts load and two animation frames have painted. */
export async function waitForLayoutStable(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    )
  })
}

/**
 * Resolve when a request whose URL contains `fragment` finishes (or fails).
 * Only requests issued after this call are considered.
 */
export function waitForApiSettled(page, fragment, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      page.off('requestfinished', onFinished)
      page.off('requestfailed', onFailed)
    }
    const onFinished = async request => {
      if (!request.url().includes(fragment)) return
      cleanup()
      const response = await request.response().catch(() => null)
      resolve({ request, status: response?.status() ?? 0, failed: false })
    }
    const onFailed = request => {
      if (!request.url().includes(fragment)) return
      cleanup()
      resolve({ request, status: 0, failed: true })
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out after ${timeout}ms waiting for ${fragment}`))
    }, timeout)
    page.on('requestfinished', onFinished)
    page.on('requestfailed', onFailed)
  })
}

/**
 * Navigate to a hash route and resolve only once the *destination* is ready:
 *
 * 1. the URL hash path equals `expectPath` (default `path`);
 * 2. every visible h1 is the destination's (`heading`), so the previous
 *    route's page can never satisfy the wait — for routes without an h1,
 *    pass `ready` text instead and no h1 may be visible;
 * 3. the `/api/workspace?name=<workspace>` request issued by this
 *    navigation has finished (success, error status or network failure);
 * 4. every `[data-workspace-mode]` element (WorkspaceState contract) is no
 *    longer `loading`/`refreshing` — pages without one skip this step;
 * 5. fonts are loaded and two animation frames have painted.
 *
 * `heading`, `ready` and `workspace` default to the ROUTES registry entry for
 * `expectPath`; pass `workspace: null` to skip the API wait.
 *
 * @returns {Promise<{ elapsed: number, workspace?: { status: number, failed: boolean } }>}
 */
export async function gotoRoute(page, path, options = {}) {
  const expectPath = options.expectPath ?? path
  const known = ALL_ROUTES.find(route => route.path === expectPath)
  const heading = 'heading' in options ? options.heading : known?.heading
  const ready = 'ready' in options ? options.ready : known?.ready
  const workspace =
    'workspace' in options ? options.workspace : (known?.workspace ?? null)
  const timeout = options.timeout ?? 15000
  if (!heading && !ready)
    throw new Error(`gotoRoute(${path}) needs a heading or ready text`)
  const started = Date.now()

  const settled = workspace
    ? waitForApiSettled(page, `/api/workspace?name=${workspace}`, timeout)
    : null
  // Avoid an unhandled rejection if an earlier step throws first.
  settled?.catch(() => {})

  const target = `/#${path}`
  const current = page.url()
  if (current !== 'about:blank' && hashPath(current) === path)
    await page.reload()
  else await page.goto(target)

  await expect
    .poll(() => hashPath(page.url()), {
      message: `URL should reach #${expectPath}`,
      timeout
    })
    .toBe(expectPath)

  if (heading) {
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: heading,
        exact: typeof heading === 'string'
      })
    ).toBeVisible({ timeout })
  } else {
    await expect(page.getByText(ready).first()).toBeVisible({ timeout })
  }
  await expect
    .poll(
      async () => {
        const texts = await visibleH1Texts(page)
        return heading
          ? texts.length > 0 && texts.every(t => matchesHeading(heading, t))
          : texts.length === 0
      },
      { message: `only the ${expectPath} heading may be visible`, timeout }
    )
    .toBe(true)

  const result = { elapsed: 0 }
  if (settled) {
    const { status, failed } = await settled
    result.workspace = { status, failed }
  }
  await expect
    .poll(
      async () =>
        (await workspaceModes(page)).every(
          mode => !UNSETTLED_WORKSPACE_MODES.includes(mode)
        ),
      { message: 'data-workspace-mode should settle', timeout }
    )
    .toBe(true)
  await waitForLayoutStable(page)
  result.elapsed = Date.now() - started
  return result
}

/** Measure document width and list elements whose right edge overflows. */
export function measureOverflow(page) {
  return page.evaluate(() => {
    const viewport = window.innerWidth
    const describe = el => {
      let text = el.tagName.toLowerCase()
      if (el.id) text += `#${el.id}`
      const classes = [...el.classList].slice(0, 4)
      if (classes.length) text += `.${classes.join('.')}`
      const label = (el.getAttribute('aria-label') || el.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40)
      return label ? `${text} "${label}"` : text
    }
    const clippedByAncestor = el => {
      for (
        let parent = el.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        if (
          getComputedStyle(parent).overflowX !== 'visible' &&
          parent.getBoundingClientRect().right <= viewport + 0.5
        )
          return true
      }
      return false
    }
    const offenders = []
    for (const el of document.body.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height || rect.right <= viewport + 0.5) continue
      if (!el.checkVisibility({ visibilityProperty: true })) continue
      if (clippedByAncestor(el)) continue
      offenders.push({
        element: describe(el),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width)
      })
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: viewport,
      offenders
    }
  })
}

export const formatOverflow = ({ scrollWidth, innerWidth, offenders }) =>
  [
    `document is ${scrollWidth}px wide in a ${innerWidth}px viewport; ` +
      `${offenders.length} element(s) extend past the right edge:`,
    ...offenders
      .slice(0, 20)
      .map(o => `  ${o.element} [x ${o.left}→${o.right}, ${o.width}px wide]`),
    offenders.length > 20 ? `  …and ${offenders.length - 20} more` : ''
  ]
    .filter(Boolean)
    .join('\n')

/**
 * Assert `documentElement.scrollWidth <= innerWidth`, retrying briefly for
 * late layout; the failure message lists the offending elements.
 */
export async function expectNoHorizontalOverflow(
  page,
  { timeout = 2000 } = {}
) {
  const deadline = Date.now() + timeout
  let report = await measureOverflow(page)
  while (report.scrollWidth > report.innerWidth && Date.now() < deadline) {
    await waitForLayoutStable(page)
    report = await measureOverflow(page)
  }
  expect(report.scrollWidth, formatOverflow(report)).toBeLessThanOrEqual(
    report.innerWidth
  )
}

/** Full-page screenshot at `test-results/<name>-<width>.png`. */
export function screenshotRoute(page, name, width, suffix = '') {
  return page.screenshot({
    path: `test-results/${name}-${width}${suffix}.png`,
    fullPage: true
  })
}

/** Collect uncaught page errors; assert the returned array is empty. */
export function trackPageErrors(page) {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  return errors
}

/** Pick an option from a Quasar QSelect by its exact label. */
export async function chooseOption(page, label, text) {
  await expect(page.getByLabel(label, { exact: true })).toHaveCount(1)
  await page.getByLabel(label, { exact: true }).click()
  await page.getByRole('option').filter({ hasText: text }).first().click()
}
