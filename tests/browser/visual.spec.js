// Visual-system guarantees (MF-13): routine surfaces are flat, nothing in the
// page paints a gradient, and the text tokens stay readable on every
// background token.
import { test, expect } from '@playwright/test'
import { ROUTES, gotoRoute, mockApi, routeTarget } from './support/index.js'

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1440, height: 900 }
]

for (const route of [ROUTES.dashboard, ROUTES.operations, ROUTES.finance])
  for (const viewport of VIEWPORTS)
    test(`${route.name} surfaces are flat at ${viewport.width}px`, async ({
      page
    }) => {
      await page.setViewportSize(viewport)
      await mockApi(page, { role: 'admin_owner' })
      await gotoRoute(page, route.path, routeTarget(route))

      const offenders = await page.evaluate(() => {
        const describe = el =>
          `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`
        const found = []
        const content = document.querySelector('.q-page-container')
        for (const el of content.querySelectorAll('*')) {
          const style = getComputedStyle(el)
          if (/gradient\(/.test(style.backgroundImage))
            found.push(`${describe(el)} gradient`)
          if (
            el.matches('.surface-card, .q-card') &&
            style.boxShadow !== 'none'
          )
            found.push(`${describe(el)} box-shadow ${style.boxShadow}`)
        }
        return found
      })
      expect(offenders).toEqual([])
    })

test('text tokens meet 4.5:1 on every background token', async ({ page }) => {
  await mockApi(page, { role: 'admin_owner' })
  await gotoRoute(page, ROUTES.dashboard.path, routeTarget(ROUTES.dashboard))

  const results = await page.evaluate(() => {
    const probe = document.createElement('div')
    document.body.append(probe)
    const rgb = token => {
      probe.style.color = `var(${token})`
      return getComputedStyle(probe)
        .color.match(/\d+(\.\d+)?/g)
        .map(Number)
    }
    const luminance = ([r, g, b]) => {
      const channel = v => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const contrast = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    const texts = [
      '--boms-color-text',
      '--boms-color-text-muted',
      '--boms-color-heading'
    ]
    const backgrounds = [
      '--boms-color-canvas',
      '--boms-color-surface',
      '--boms-color-surface-subtle',
      '--boms-color-chrome',
      '--boms-color-selected-bg',
      '--boms-color-neutral-bg'
    ]
    const out = []
    for (const text of texts)
      for (const background of backgrounds)
        out.push({
          pair: `${text} on ${background}`,
          ratio: Math.round(contrast(rgb(text), rgb(background)) * 100) / 100
        })
    probe.remove()
    return out
  })

  const failing = results.filter(({ ratio }) => !(ratio >= 4.5))
  expect(failing).toEqual([])
})
