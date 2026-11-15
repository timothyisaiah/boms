# BOMS UX validation checklist

Use this checklist for each controlled iteration. A check is not complete without recorded evidence (test result, screenshot, accessibility tree, measurement, or reviewer sign-off).

## Baseline commands

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run test:neon` against an isolated, explicitly selected test branch when server/database behavior changes
- [ ] `npm run test:users:neon` when access management changes
- [ ] `npm run test:mobile`
- [ ] `npm run lint:check`
- [ ] `npm run build`
- [ ] Confirm the optional live Neon browser smoke test is either run safely or explicitly recorded as skipped

Audit baseline on 15 November 2026: typecheck, build, 7 domain/migration tests, and 17 non-live browser tests passed; one live smoke test skipped; lint failed on three pre-existing formatting issues.

## Viewport matrix

For each route (`/auth`, `/`, `/operations`, `/retail`, `/finance`, `/admin`, `/access-denied`, 404):

- [ ] 320 px width
- [ ] 375 px width
- [ ] 430 px width
- [ ] 768 px width
- [ ] 1024 px width
- [ ] 1440 px width
- [ ] Representative short and tall phone heights
- [ ] Portrait and landscape
- [ ] 200% text zoom
- [ ] 400% reflow for essential workflows
- [ ] `document.documentElement.scrollWidth <= window.innerWidth`
- [ ] No fixed/sticky element covers fields, messages, or actions
- [ ] Long email, SKU, batch, reference, and partner values wrap safely
- [ ] Destination-specific heading and settled loading state are awaited before assertions/screenshots

## Global navigation

- [ ] Authorized destinations match the approved role matrix
- [ ] Unauthorized destinations are absent, not merely disabled
- [ ] Direct unauthorized URLs show a semantic heading and recovery action
- [ ] Drawer opens/closes by touch and keyboard; focus returns to trigger
- [ ] Current route is announced and visually active
- [ ] Mobile page title is available without reading body content
- [ ] Bottom navigation, if implemented, has at most four items and safe-area padding
- [ ] Browser back/forward restores route and selected task/view
- [ ] Sign out is reachable and clears session-specific drafts/retry state

## Authentication

- [ ] Email and password labels/autocomplete are correct
- [ ] Password visibility control has an accurate accessible name/state
- [ ] Duplicate submit is prevented
- [ ] Invalid credentials, network failure, expired session, and inactive account are distinct
- [ ] Safe `next` redirect works; external/open redirects remain rejected
- [ ] Mobile virtual keyboard does not cover submit or errors
- [ ] No password or auth token appears in client storage, logs, screenshots, or error messages

## Workspace loading and freshness

- [ ] Initial state says Loading, not Empty, Live, Preview, or Unavailable
- [ ] Successful response says Live exactly once
- [ ] Empty live data is distinguishable from load failure
- [ ] Manual refresh retains previous successful data until replacement arrives
- [ ] Failed refresh keeps prior data and shows a truthful warning
- [ ] Stale/aborted responses cannot overwrite a newer request
- [ ] Loading/failure/success announcements are accessible and not duplicated
- [ ] Dashboard and all workspaces use the same mode contract

## Purchase receipt

- [ ] Supplier/date/material/quantity/cost required rules fire inline
- [ ] Numeric keyboard and decimal behavior are correct
- [ ] Multiple lines can be added/removed with 44 px targets
- [ ] Duplicate explicit lot code is prevented before submit
- [ ] Blank lot code remains server-generated
- [ ] Running total matches submitted lines
- [ ] Pending/uncertain write locks editing and retries the exact key/body
- [ ] Success resets only after confirmed save and refreshes stock
- [ ] Draft restoration/clear behavior matches policy

## Production batch

- [ ] Variant/date/code/output/input rules fire inline
- [ ] Batch code suggestion and duplicate handling remain correct
- [ ] Recipe defaults multiply accurately and remain editable
- [ ] FIFO material option remains available
- [ ] Explicit lot quantity cannot exceed remaining stock
- [ ] Duplicate use of a lot aggregates before availability validation
- [ ] Expiry date policy is clear; unknown expiry creates a follow-up state if required
- [ ] Estimated input and unit cost are labeled estimates and match inputs
- [ ] Server transaction preserves traceability and concurrency safety

## Stock issue

- [ ] Only authorized roles can submit
- [ ] Retailer/date/batch/whole-jar quantity rules fire inline
- [ ] Availability is adjacent to the selected batch
- [ ] Duplicate batch lines aggregate for stock validation
- [ ] Estimated quantity/value matches submission
- [ ] Success does not describe dispatch as a completed sale
- [ ] Concurrent stock reduction returns a clear recoverable conflict

## Reconciliation

- [ ] Only authorized roles can submit
- [ ] Retailer selection filters open issue lines
- [ ] Effective variant price is read-only and date-correct
- [ ] Missing price blocks submission with a specific recovery path
- [ ] Sold + returned + damaged + expired + remaining equals opening quantity
- [ ] Live unaccounted quantity is visible per line
- [ ] Return/loss reason becomes required when relevant
- [ ] Good returns, damage, and expiry use the correct inventory/liability rules
- [ ] Duplicate issue lines are prevented
- [ ] Multi-line draft survives approved interruptions and is user-isolated
- [ ] Success confirmation shows liability and inventory disposition

## Remittance

- [ ] Only authorized roles can submit
- [ ] Retailer/date/positive amount rules fire inline
- [ ] Current outstanding is correct and clearly dated
- [ ] Optional reconciliation link is explained
- [ ] Multiple partial payments remain supported
- [ ] Unlinked allocation and overpayment/credit behavior match approved rules
- [ ] Success updates balance without altering reconciliation history

## Expense

- [ ] Only authorized roles can submit
- [ ] Category/date/positive amount rules fire inline
- [ ] Category behavior matches approved free-text or controlled vocabulary policy
- [ ] Currency input/format is consistent
- [ ] Success updates profit summary and record history

## Administration and catalogue

- [ ] Owner can create/edit/deactivate users and reset passwords
- [ ] Last active owner and self-edit safeguards remain enforced
- [ ] Deactivation/password reset revokes sessions
- [ ] Operations manager catalogue access matches approved matrix
- [ ] Material type/unit and variant product identity remain immutable where history requires
- [ ] Inactive partners/materials/variants leave new-entry pickers but remain in history
- [ ] Prices are variant-only with effective history
- [ ] Recipes prefill but never lock actual batch consumption
- [ ] Dirty dialogs warn before discard and return focus on close

## Records and reports

- [ ] Mobile cards expose identity, status, quantity/amount, date, and next action
- [ ] Desktop tables sort, filter, and paginate using server-authoritative state
- [ ] Card and table modes expose identical data, actions, and permissions
- [ ] Stable row keys are used
- [ ] Weekly period is Monday–Sunday in Uganda context
- [ ] Monthly period and historical valuation remain correct
- [ ] Role-based report redaction remains enforced server-side
- [ ] Empty/loading/error report states are distinct
- [ ] Export is present only if a validated business need exists

## Accessibility (WCAG 2.2 AA target)

- [ ] One unique `h1` per route; coherent `h2`/`h3` order
- [ ] Landmarks/sections have accessible names where required
- [ ] All controls have programmatic names and states
- [ ] Keyboard order matches visual/reading order
- [ ] Focus is always visible and not obscured by sticky UI
- [ ] Dialog focus is trapped and restored correctly
- [ ] First invalid field receives focus after failed submit
- [ ] Errors are associated with fields and summarized
- [ ] Status/error/success announcements use appropriate live semantics
- [ ] Touch targets are at least 44×44 px
- [ ] Text contrast is at least 4.5:1; large text/UI boundaries meet applicable 3:1 requirements
- [ ] Information is not conveyed by color alone
- [ ] Reduced-motion preference removes nonessential animation
- [ ] Charts/trends have equivalent text
- [ ] Screen-reader smoke tests cover sign in, navigation, one write form, retry, and reports

## Performance and resilience

- [ ] Measure production-like initial payload size per workspace
- [ ] Histories are paginated/date bounded; no complete-history initial fetch
- [ ] First useful task UI renders before histories
- [ ] Route chunks remain lazy loaded
- [ ] No duplicate workspace/report requests from a single action
- [ ] Long lists/tables remain responsive at production-like row counts
- [ ] Images/fonts are cached and sized appropriately
- [ ] LCP, INP, and CLS budgets are defined and measured on a mid-range phone profile
- [ ] Slow network, offline transition, timeout, 401, 403, 409, 422, and 503 states are tested
- [ ] `ResizeObserver` development errors are investigated and either fixed or documented as benign framework tooling behavior

## Security and data integrity regression

- [ ] Browser never receives database credentials
- [ ] Every write requires authenticated role, same origin, validation, and idempotency key
- [ ] Retry with same key/body returns the original result
- [ ] Same key with a different actor/action/body is rejected
- [ ] Money/inventory writes remain transactional and concurrency safe
- [ ] Client simplification does not remove server validation or audit fields
- [ ] Error logs exclude credentials, request bodies, passwords, SQL parameters, and connection strings

## Release sign-off record

Record for each release:

- build/commit identifier;
- test environment and data profile;
- browsers/devices and viewport matrix;
- automated results;
- manual accessibility reviewer;
- business-role reviewers;
- known issues and accepted assumptions;
- screenshots/traces location;
- approver and date.
