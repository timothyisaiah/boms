# Browser tests

Playwright specs for the BOMS UI. They run against the Quasar dev server with
every `/api` request mocked, so no database or `.env` file is needed (except
`live-neon.spec.js`, which is opt-in via `BOMS_LIVE_UI=1`).

## Running

```sh
# Pick a free port per checkout/worktree; never share port 9000 between runs.
PW_PORT=9202 npx playwright test                 # everything
PW_PORT=9202 npx playwright test responsive      # one spec file
PW_PORT=9202 npx playwright test -g "320px"      # by test title
```

`playwright.config.js` reads `PW_PORT` and starts its own dev server on it
(it only reuses an existing server when `PW_PORT` is unset). npm scripts:
`npm run test:browser` (all), `npm run test:responsive`, `npm run test:a11y`,
and the original `npm run test:mobile` (all browser specs).

Full-page screenshots land in `test-results/<route>-<width>.png` and are taken
only after `gotoRoute` has resolved, so each one shows its own destination.

## Layout

| File                                              | Covers                                                          |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `support/fixtures.js`                             | Fixture data (`createFixtures`) and `mockApi`                   |
| `support/routes.js`                               | Route registry: path, h1, workspace, roles (from the router)    |
| `support/helpers.js`                              | `gotoRoute`, viewports, overflow assertion, screenshots         |
| `support/a11y.js`                                 | Heading-outline checks, reduced-motion emulation                |
| `support/index.js`                                | Re-exports all of the above                                     |
| `responsive.spec.js`                              | Every route × every reference width fits; role access matrix    |
| `a11y.spec.js`                                    | Single h1 / no skipped heading levels per route; reduced motion |
| `harness.spec.js`                                 | Self-tests proving `gotoRoute` cannot resolve early             |
| `operations.spec.js` etc.                         | Per-module behaviour (operations, retail, finance, dashboard)   |
| `workflows.spec.js`                               | Journeys across modules (all six phone forms)                   |
| `users`/`materials`/`partners`/`variants.spec.js` | Management screens (own inline mocks)                           |

## `mockApi(page, options)`

Routes `**/api/**` and returns `{ fixtures, requests }` (`requests` records
every call as `{ key, method, url, body }`).

| Option      | Default         | Meaning                                                              |
| ----------- | --------------- | -------------------------------------------------------------------- |
| `role`      | `'admin_owner'` | Signed-in role; `null` = signed out (`/api/auth` answers 401)        |
| `user`      | –               | Extra fields merged into the signed-in user                          |
| `delays`    | `{}`            | `{ key: ms }` wait before answering                                  |
| `failures`  | `{}`            | `{ key: status \| 'abort' \| fulfillOptions }`                       |
| `overrides` | `{}`            | `{ key: json \| (route, url, fixtures) => … }`                       |
| `fixtures`  | fresh copy      | Data to serve; mutate `createFixtures()` output to shape a scenario  |
| `fonts`     | `true`          | Serve web fonts from disk if the dev server refuses them (see below) |

Keys are the path after `/api/`, refined for workspaces and writes:
`workspace:finance`, `workspace` (all workspaces), `write:purchases`, `write`,
`reports`, `users`, `materials`, `variants`, `partners`, `auth`. The specific
key wins over the generic one.

```js
const { requests } = await mockApi(page, {
  role: 'finance_accountant',
  delays: { 'workspace:finance': 1500 },
  failures: { reports: 503, 'workspace:retail': 'abort' },
  overrides: { 'workspace:finance': { ...emptyFinance, mode: 'live' } }
})
```

A test that needs to inspect writes can add its own
`page.route('**/api/write?*', …)` after `mockApi`; later routes take priority.

**Fonts in worktrees:** git worktrees that share `node_modules` through a
junction resolve fonts outside Vite's `server.fs.allow`, so the dev server
answers 403 and the app falls back to system fonts. That changes text metrics
enough to move tabs under the scroll arrows and to change overflow results.
`mockApi` therefore serves those font files from disk when (and only when) the
dev server refuses them.

## `gotoRoute(page, path, options)`

Navigate to `/#<path>` and resolve only when the destination is ready:

1. the URL hash path equals `expectPath` (default: `path`);
2. a visible `h1` with the expected accessible name exists **and every
   visible h1 is the destination's**, so the previous route's page can never
   satisfy the wait (routes with no h1 pass `ready` text instead and must
   show no h1);
3. the `/api/workspace?name=<workspace>` request issued by this navigation
   has finished — success, error status or network failure;
4. every `[data-workspace-mode]` element is no longer `loading` or
   `refreshing` (skipped when none is rendered);
5. `document.fonts.ready` and two animation frames.

`heading`, `ready` and `workspace` default to the `ROUTES` entry for
`expectPath`, so `await gotoRoute(page, '/finance')` is usually enough. Pass
`workspace: null` to skip the API wait. For role redirects use
`gotoRoute(page, '/finance', { expectPath: '/access-denied' })`. Navigating to
the current route reloads the page so that a fresh workspace request occurs.
It returns `{ elapsed, workspace: { status, failed } }`.

### `data-workspace-mode` contract

The forthcoming `WorkspaceState` component (MF-04) renders
`data-workspace-mode="loading|live|refreshing|unavailable"` on its root.
`gotoRoute` waits while any such element says `loading` or `refreshing`;
`live` and `unavailable` are settled. Pages that render several
`WorkspaceState`s must settle all of them. `harness.spec.js` simulates the
component, so the contract is tested before any page adopts it.

## Other helpers

- `VIEWPORTS` — 320×568, 375×812, 430×932, 768×1024, 1024×768, 1440×900;
  `LEGACY_VIEWPORTS` — 390 and 1280 (the original suite's widths).
- `expectNoHorizontalOverflow(page)` — asserts
  `documentElement.scrollWidth <= innerWidth`; on failure the message lists
  each element whose right edge passes the viewport (ignoring content clipped
  by a scrolling ancestor), e.g.
  `div.dashboard-hero__controls [x 37→331, 295px wide]`.
- `screenshotRoute(page, name, width, suffix?)`, `trackPageErrors(page)`,
  `chooseOption(page, label, optionText)` for Quasar selects,
  `visibleH1Texts(page)`, `workspaceModes(page)`, `waitForLayoutStable(page)`.
- `expectSingleH1(page)`, `expectNoSkippedHeadingLevels(page)`,
  `headingOutline(page)`, `emulateReducedMotion(page)`.

## Adding a module spec

```js
// tests/browser/retail.spec.js
import { test, expect } from '@playwright/test'
import { gotoRoute, mockApi, VIEWPORTS } from './support/index.js'

test('issue stock shows live batches', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[1])
  const { fixtures } = await mockApi(page) // or tweak createFixtures() first
  await gotoRoute(page, '/retail')
  await page.getByRole('tab', { name: 'Issue stock', exact: true }).click()
  // …
})
```

Keep one file per module so parallel work does not collide; put fixture
additions in `support/fixtures.js` and new routes in `support/routes.js`
(they then join the responsive and a11y matrices automatically). Always
navigate with `gotoRoute`, never `page.goto` plus a `.q-page` wait.
