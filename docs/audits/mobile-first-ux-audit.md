# Mobile-first UX audit and finding register

Audit date: 15 November 2026  
Evidence levels: **Verified defect**, **Verified constraint**, **Design recommendation**, or **Assumption to validate**

## Overall assessment

BOMS is operationally complete on phones at 375–390 px and its six primary write forms preserve business rules. It is not yet consistently mobile-first at the 320 px minimum. The dashboard has confirmed horizontal overflow, core task controls begin more than one viewport below the route entry, and module tabs hide most destinations behind horizontal scrolling. Desktop is usable but often displays stretched mobile cards rather than higher-efficiency records.

## Viewport evidence

A temporary Playwright audit probe waited for each destination heading and live workspace response before measuring the DOM. It was removed after the run. Data-heavy behavior was also inspected through the repository's fixture-backed 375/390/1280 px suite and screenshots.

| Width | Result             | Key observations                                                                                                                                                                                                                       |
| ----: | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   320 | **Fail**           | Dashboard document width is 331 px; `.dashboard-hero__controls`/`QBtnToggle` extends 11 px beyond the viewport. Operations hero is 616 px high and its workspace starts at 1,277 px. Only 2/5 Operations and Finance tabs are visible. |
|   375 | Conditional pass   | No document overflow in the explicit probe. Operations workspace begins at 1,179 px, Retail at 1,058 px, Finance at 1,144 px. Only 2/5 Operations and Finance tabs are visible.                                                        |
|   430 | Pass with friction | No document overflow; only 3/5 Operations/Finance tabs are visible.                                                                                                                                                                    |
|   768 | Pass               | No document overflow; all tabs are visible; two-column enhancement begins.                                                                                                                                                             |
|  1024 | Pass               | Drawer becomes persistent and records fit, but card-only histories underuse the width.                                                                                                                                                 |
|  1440 | Pass               | No overflow; large content area remains card-oriented and visually spacious rather than operationally dense.                                                                                                                           |

The probe used empty but structurally valid live workspaces. Existing Playwright fixtures cover populated 375, 390, and 1280 px states. The current repository suite does not reliably wait for destination-specific content; MF-11 addresses that gap.

## Prioritized finding register

### MF-01 — Dashboard overflows at 320 px

- **Type:** Verified defect
- **Module and route:** Dashboard, `/`
- **Component/file:** [IndexPage.vue](../../src/pages/IndexPage.vue#L28), [app.scss](../../src/css/app.scss#L444)
- **Affected viewport:** 320 px
- **Category:** Responsive layout / mobile blocker
- **Observed problem:** The document is 331 px wide in a 320 px viewport. The 295 px-wide dashboard control group begins at x=37 and ends at x=331.
- **Evidence:** Explicit destination-aware browser measurement; overflow offenders are `.dashboard-hero__controls`, `.dashboard-view-toggle`, and its final toggle button.
- **User impact:** Horizontal page movement and a partially clipped primary mode control at the minimum supported phone width.
- **Business impact:** The business review entry screen fails the stated minimum-width success criterion.
- **Severity:** High
- **Proposed solution:** Set the control container to `width: 100%; min-width: 0`; use a compact two-row or select/menu treatment at 320 px; ensure toggle children may shrink/wrap without changing view semantics.
- **Implementation effort:** Small
- **Dependencies:** None
- **Acceptance criteria:** At 320 px, `documentElement.scrollWidth <= innerWidth`; all three modes are visible and operable; labels remain understandable at 200% text zoom.

### MF-02 — Primary tasks begin below excessive non-task content

- **Type:** Verified constraint
- **Module and route:** Operations, Distribution, Finance
- **Component/file:** [OperationsPage.vue](../../src/pages/OperationsPage.vue#L3), [RetailPage.vue](../../src/pages/RetailPage.vue#L3), [FinancePage.vue](../../src/pages/FinancePage.vue#L3)
- **Affected viewport:** 320–430 px
- **Category:** Journey efficiency / information hierarchy
- **Observed problem:** A large hero, up to six secondary management actions, and metric cards precede forms. At 375 px the workspace begins 1,179 px down in Operations, 1,058 px in Retail, and 1,144 px in Finance.
- **Evidence:** Browser bounding-box measurements and 375 px full-page screenshots.
- **User impact:** Frequent users scroll past roughly 1.25–1.5 phone screens before choosing a task.
- **Business impact:** Slower repetitive entry, higher chance of selecting the wrong hidden task, and weaker one-handed use.
- **Severity:** High
- **Proposed solution:** Replace the hero with a compact page header; promote one role-appropriate primary action; move management actions into overflow/settings; reduce metrics to an optional compact strip below the task selector.
- **Implementation effort:** Medium
- **Dependencies:** Agreed role/task frequency; navigation decision in MF-16
- **Acceptance criteria:** On 375 px, the primary task selector/action appears within the first viewport; the active form begins no lower than 600 px; all current actions remain reachable.

### MF-03 — Mobile task tabs hide most destinations

- **Type:** Verified defect
- **Module and route:** Operations, Distribution, Finance
- **Component/file:** Workspace `QTabs` in the three route pages
- **Affected viewport:** 320–430 px
- **Category:** Local navigation / discoverability
- **Observed problem:** Only 2/5 Operations and Finance tabs are visible at 320/375 px; labels are clipped in screenshots and users must infer horizontal scroll/arrows.
- **Evidence:** DOM visibility counts and 375 px screenshots.
- **User impact:** Expense, records, batch, and history destinations are easy to miss.
- **Business impact:** Incomplete or delayed operational work and training burden.
- **Severity:** High
- **Proposed solution:** Separate “Do” and “Review” destinations; use a compact task menu/segmented control for 2–3 high-frequency actions; encode selection in the URL; retain full tabs on tablet/desktop.
- **Implementation effort:** Medium
- **Dependencies:** Journey prioritization; route/query design
- **Acceptance criteria:** Every task is named without horizontal swiping at 320 px; keyboard and screen-reader users can enumerate all destinations; direct links restore the selected view.

### MF-04 — Dashboard availability state uses inconsistent mode values

- **Type:** Verified defect
- **Module and route:** Dashboard, `/`
- **Component/file:** [dashboard.js](../../src/services/dashboard.js#L540), [IndexPage.vue](../../src/pages/IndexPage.vue#L15)
- **Affected viewport:** All
- **Category:** Error state / trust
- **Observed problem:** The preview/failure model sets `mode: 'unavailable'`, while the chip and banner test for `'preview'`. On failure, the chip can say “Live data” and the generic unavailable banner does not render, although a separate load error may appear.
- **Evidence:** Direct code comparison.
- **User impact:** Ambiguous data freshness during connection failure.
- **Business impact:** Users may act on empty/stale-looking metrics as if they are live.
- **Severity:** High
- **Proposed solution:** Define one workspace-mode enum (`loading`, `live`, `unavailable`) and a shared status component.
- **Implementation effort:** Small
- **Dependencies:** None
- **Acceptance criteria:** Initial load, success, timeout, 401, and 5xx each show a truthful, screen-reader-announced state; no “Live data” label appears without a successful response.

### MF-05 — Client routes and server capabilities disagree

- **Type:** Verified defect requiring policy confirmation
- **Module and route:** `/operations`, `/retail`, `/finance`, `/admin`; workspace APIs
- **Component/file:** [routes.js](../../src/router/routes.js), [MainLayout.vue](../../src/layouts/MainLayout.vue), [server/auth.ts](../../server/auth.ts), [server/workspaces.ts](../../server/workspaces.ts)
- **Affected viewport:** All
- **Category:** Authorization / information architecture
- **Observed problem:** Server workspace role sets are broader than route role sets. Operations managers are permitted by the API to manage prices/recipes, but the only UI is on owner-only `/admin`. Sales can call the finance review workspace but cannot navigate there; read-only management can call retail but cannot navigate there.
- **Evidence:** Role-array comparison.
- **User impact:** Authorized capabilities may be hidden, while direct API access differs from visible navigation.
- **Business impact:** Permission drift, support workarounds, and audit ambiguity.
- **Severity:** High
- **Proposed solution:** Approve one capability matrix, derive router/nav/page behavior from it, and keep server enforcement authoritative. Give catalogue settings a route authorized for owner and operations manager if that matches policy.
- **Implementation effort:** Medium
- **Dependencies:** Owner approval of role matrix
- **Acceptance criteria:** A role-by-capability test asserts route visibility, page actions, workspace reads, and writes; every deliberate read/write asymmetry is documented.

### MF-06 — Workspace reads and record views are unbounded

- **Type:** Verified architectural risk
- **Module and route:** All workspaces
- **Component/file:** [server/workspaces.ts](../../server/workspaces.ts), principal page list loops
- **Affected viewport:** All; mobile networks most affected
- **Category:** Performance / scalability
- **Observed problem:** Workspace projections return full purchase, batch, issue, movement, reconciliation, remittance, and expense histories with nested items. Most record tabs render entire arrays as cards.
- **Evidence:** SQL projections have ordering but no `LIMIT`, cursor, or date filter; templates use direct `v-for` loops.
- **User impact:** Increasing load time, memory use, rerender cost, and scroll length as history accumulates.
- **Business impact:** Operational performance degrades in proportion to business success.
- **Severity:** High
- **Proposed solution:** Split summary/reference payloads from paginated histories; add server-side date/search filters; virtualize only when pagination alone is insufficient.
- **Implementation effort:** Large
- **Dependencies:** API contract and query changes; preserve report/accounting logic
- **Acceptance criteria:** Initial workspace payload stays within an agreed budget; first useful content renders without full history; pagination/filter state is stable and role checked.

### MF-07 — Long-form drafts are lost outside uncertain-write recovery

- **Type:** Verified constraint
- **Module and route:** Production, stock issue, reconciliation, remittance, expense
- **Component/file:** Local reactive forms in the principal pages; [writes.js](../../src/services/writes.js)
- **Affected viewport:** All; mobile interruption risk highest
- **Category:** Data entry / recovery
- **Observed problem:** Only an already-submitted, network-uncertain body is persisted. Ordinary in-progress values disappear on refresh, sign-out, or route destruction.
- **Evidence:** Form state is component-local; persistence exists only inside `writeAction()`.
- **User impact:** Re-entry after accidental navigation, browser refresh, call interruption, or session expiry.
- **Business impact:** Lost time and increased transcription error, especially during retailer counts.
- **Severity:** High
- **Proposed solution:** Add explicit, user-scoped session drafts for long forms; clear on success/sign-out; warn before discarding; never reuse an idempotency key until submission begins.
- **Implementation effort:** Medium
- **Dependencies:** Shared-device/privacy decision
- **Acceptance criteria:** A populated reconciliation survives same-user refresh and route round-trip; successful save clears it; another user cannot see it.

### MF-08 — Visual section titles are not a coherent heading structure

- **Type:** Verified accessibility defect
- **Module and route:** Most pages; access-denied and record cards
- **Component/file:** Global `.section-title` pattern and [UnauthorizedPage.vue](../../src/pages/UnauthorizedPage.vue)
- **Affected viewport:** All
- **Category:** WCAG 2.2 AA / semantics
- **Observed problem:** Many section titles are styled `div` elements. The access-denied page has no semantic heading. Repeated cards rely on visual weight rather than heading levels.
- **Evidence:** Template inspection; the browser accessibility query could not locate “Access restricted” as a heading.
- **User impact:** Screen-reader heading navigation does not reflect the visual hierarchy.
- **Business impact:** Accessibility compliance risk and slower navigation for assistive technology users.
- **Severity:** Medium
- **Proposed solution:** Use one `h1` per page, `h2` for major sections, `h3` for subsections/cards where useful; keep styling classes independent from element type.
- **Implementation effort:** Small
- **Dependencies:** None
- **Acceptance criteria:** Automated heading audit has no skipped levels; every route has a unique accessible `h1`; visual appearance is unchanged unless intentionally refined.

### MF-09 — Safe-area and reduced-motion support are absent

- **Type:** Verified accessibility/responsive gap
- **Module and route:** Global layout, sticky form footer, animated tab panels
- **Component/file:** [app.scss](../../src/css/app.scss), three `QTabPanels animated` instances
- **Affected viewport:** Mobile devices with display cutouts; users requesting reduced motion
- **Category:** Accessibility / device adaptation
- **Observed problem:** No `env(safe-area-inset-*)` use and no `prefers-reduced-motion` rule. Sticky submit controls use `bottom: 0`; tab-panel animation is always enabled.
- **Evidence:** Repository search.
- **User impact:** Bottom actions may sit against browser/home UI; transitions ignore user preference.
- **Business impact:** Preventable device/accessibility friction.
- **Severity:** Medium
- **Proposed solution:** Add safe-area padding to shell and sticky actions; disable nonessential transitions and panel animation under reduced motion.
- **Implementation effort:** Small
- **Dependencies:** Device testing
- **Acceptance criteria:** Submit controls remain fully visible on iOS/Android cutout devices and landscape; reduced-motion media query removes nonessential motion.

### MF-10 — Async feedback lacks one consistent accessible contract

- **Type:** Verified accessibility gap
- **Module and route:** Workspace pages and auth
- **Component/file:** Load-error/action banners in page templates; `QNotify` calls
- **Affected viewport:** All
- **Category:** Accessibility / error recovery
- **Observed problem:** `WriteStatus` has `role=status` and `aria-live`, but page load errors and action feedback do not consistently declare alert/status semantics. Retail/Finance use transient notifications for submit validation summaries.
- **Evidence:** Markup inspection.
- **User impact:** Screen-reader users may miss important load or save outcomes; transient messages may disappear before review.
- **Business impact:** Users may retry or duplicate work despite idempotency protection.
- **Severity:** Medium
- **Proposed solution:** Standardize `AsyncStateBanner`/form error summary semantics; keep notifications supplementary; move focus to the first invalid field after failed submission.
- **Implementation effort:** Medium
- **Dependencies:** Shared feedback component
- **Acceptance criteria:** Screen-reader tests announce loading failure, uncertain write, validation summary, and success exactly once; focus lands predictably.

### MF-11 — Responsive browser tests can pass before the destination is ready

- **Type:** Verified test defect
- **Module and route:** Playwright “all workspaces fit” test
- **Component/file:** [mobile.spec.js](../../tests/browser/mobile.spec.js#L266)
- **Affected viewport:** Test coverage
- **Category:** Quality assurance
- **Observed problem:** The loop waits for any visible `.q-page`, which can be the previous route during navigation, and checks overflow before destination data settles. Generated files included a “finance” screenshot showing Distribution and a desktop Operations capture in pre-load preview state.
- **Evidence:** Test code and inspected screenshots.
- **User impact:** None directly; defects can escape.
- **Business impact:** False confidence in mobile readiness.
- **Severity:** High
- **Proposed solution:** Wait for destination-specific `h1`, a resolved workspace status, and stable layout; test each required width; assert the named primary form and route title.
- **Implementation effort:** Small
- **Dependencies:** MF-04 mode contract
- **Acceptance criteria:** Screenshots always match their route; 320/375/430/768/1024/1440 are covered; intentionally delayed API fixtures cannot make the test pass early.

### MF-12 — Desktop record views remain stretched mobile cards

- **Type:** Design recommendation grounded in code
- **Module and route:** Purchases, batches, movements, dispatches, finance records
- **Component/file:** Record tab templates in principal pages
- **Affected viewport:** 1024–1440 px
- **Category:** Desktop efficiency / data presentation
- **Observed problem:** Operational histories use cards at every width even where comparison, sorting, filtering, and pagination are primary.
- **Evidence:** No `QTable` in core workspaces; desktop screenshots show wide cards and unused comparison potential.
- **User impact:** Slower scanning and record comparison.
- **Business impact:** Reduced back-office productivity as history grows.
- **Severity:** Medium
- **Proposed solution:** Reuse one data source and action model; render task-appropriate cards below `md` and `QTable` at/above `md` for comparison-heavy records.
- **Implementation effort:** Medium
- **Dependencies:** MF-06 pagination API
- **Acceptance criteria:** Desktop users can sort/filter/page histories; mobile retains readable cards; permissions/actions/state remain identical.

### MF-13 — Visual treatment is heavier than the operational task requires

- **Type:** Verified design issue
- **Module and route:** Global
- **Component/file:** [app.scss](../../src/css/app.scss)
- **Affected viewport:** All, most costly on mobile
- **Category:** Design slop / hierarchy
- **Observed problem:** Repeated radial gradients, 22×48 px shadows, 20–30 px radii, nested cards, eyebrow/title duplication, and standalone metric cards create a landing-page tone and vertical expansion.
- **Evidence:** Global styles and rendered screenshots.
- **User impact:** Important forms compete with decoration and repeated labels.
- **Business impact:** Slower task recognition and less perceived operational density.
- **Severity:** Medium
- **Proposed solution:** Flatten routine surfaces, reserve elevation for overlays, use a compact page header, reduce radii/shadows, and collapse low-value metrics into a strip.
- **Implementation effort:** Medium
- **Dependencies:** Design-token revision
- **Acceptance criteria:** Primary action and form are visually dominant; no nested surface lacks a functional grouping purpose; decoration does not add task scroll.

### MF-14 — Page components combine too many responsibilities

- **Type:** Verified maintainability risk
- **Module and route:** Dashboard, Operations, Retail, Finance
- **Component/file:** Page files from 976 to 1,794 lines
- **Affected viewport:** Indirectly all
- **Category:** Component architecture
- **Observed problem:** Pages own fetch state, formatting, permission checks, domain calculations, validation, form mutation, records, and responsive presentation.
- **Evidence:** File sizes and code inventory.
- **User impact:** Slower fixes and higher regression risk.
- **Business impact:** UX inconsistencies persist because shared patterns are expensive to change.
- **Severity:** Medium
- **Proposed solution:** Extract workflow-specific components/composables after behavior tests exist; share only proven patterns, not every variation.
- **Implementation effort:** Large, incremental
- **Dependencies:** Regression tests and stable API contracts
- **Acceptance criteria:** Route pages orchestrate rather than implement every workflow; write/retry behavior and payloads remain unchanged; component tests cover extracted forms.

### MF-15 — Initial loading is presented as empty/unavailable content

- **Type:** Verified constraint
- **Module and route:** Main workspaces
- **Component/file:** Initial preview models and page loading states
- **Affected viewport:** All; slow mobile networks most visible
- **Category:** Loading / perceived performance
- **Observed problem:** Pages initialize empty/unavailable models and show zero metrics or an unavailable banner while the first request is pending. No skeleton distinguishes “not loaded” from “empty.”
- **Evidence:** Initial state code and pre-load screenshots.
- **User impact:** Flicker and uncertainty about whether there is no data or the request is still running.
- **Business impact:** Premature retries and reduced trust.
- **Severity:** Medium
- **Proposed solution:** Introduce explicit `loading` mode, preserve the last successful workspace on manual refresh, and use compact skeletons for the title/summary/task selector.
- **Implementation effort:** Medium
- **Dependencies:** Shared workspace query state
- **Acceptance criteria:** First load never labels data live or unavailable before resolution; refresh does not blank existing records; loading is announced accessibly.

### MF-16 — Global mobile navigation is not optimized for one-handed frequency

- **Type:** Design recommendation; frequency assumption requires validation
- **Module and route:** `MainLayout.vue`
- **Component/file:** [MainLayout.vue](../../src/layouts/MainLayout.vue)
- **Affected viewport:** Below 1024 px
- **Category:** Navigation
- **Observed problem:** The drawer is the only global navigation. Every cross-module transition begins at the top-left menu.
- **Evidence:** Layout inspection; current roles have two to five visible destinations.
- **User impact:** Repeated two-tap, top-of-screen navigation during operational work.
- **Business impact:** Small delays compound across high-frequency entries.
- **Severity:** Medium
- **Proposed solution:** After field validation, use a role-aware `QBottomNavigation` for up to four primary destinations and retain the drawer for settings/profile/secondary items. For owner with five destinations, place Access & Settings under “More”/drawer.
- **Implementation effort:** Medium
- **Dependencies:** Task-frequency interviews; safe-area support
- **Acceptance criteria:** Top destinations are reachable one-handed in one tap; no role sees more than four bottom items; browser back and drawer remain coherent.

### MF-17 — Desktop selects are forced into dialog behavior

- **Type:** Design recommendation grounded in code
- **Module and route:** Operational forms and managers
- **Component/file:** Multiple `QSelect behavior="dialog"` declarations
- **Affected viewport:** Tablet and desktop
- **Category:** Progressive enhancement
- **Observed problem:** Selects use mobile dialog behavior at all widths, adding modal context switching on desktop.
- **Evidence:** Template inspection.
- **User impact:** Slower keyboard/mouse selection and lost visual context.
- **Business impact:** Reduced desktop entry efficiency.
- **Severity:** Low
- **Proposed solution:** Use dialog behavior only where platform/viewport testing justifies it; otherwise allow Quasar menu behavior and searchable options for large datasets.
- **Implementation effort:** Small
- **Dependencies:** Keyboard regression tests
- **Acceptance criteria:** Desktop selection works by keyboard without modal context; phone options remain touch-friendly and readable.

## Confirmed strengths to preserve

- 44 px global button minimums, 48 px field/tab minimums, and 16 px inputs reduce touch and iOS zoom problems.
- Phone forms are single-column and repeatable lines collapse cleanly.
- Network-uncertain writes retain the original body/key and prevent a conflicting new action.
- Server validation and database transactions preserve business logic independently of UI checks.
- Report cards below `md` and `QTable` above `md` share data and formatting logic.
- Mobile management dialogs maximize below 600 px.
- Route-level code splitting is already active.

## Unverified concerns

The audit did not claim conformance for color contrast, 200–400% text zoom, screen-reader output, hardware keyboard behavior, orientation changes, virtual keyboard obstruction, or real 3G/4G performance. These require the checklist in `validation-checklist.md` before release.
