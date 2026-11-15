# UX implementation roadmap

Status: proposed; implementation must not begin until findings and role/navigation decisions are approved

## Priority model

1. Broken workflows and business-rule violations.
2. Mobile blockers.
3. Accessibility failures.
4. Inefficient journeys.
5. Navigation and information architecture.
6. Component/design inconsistencies.
7. Performance.
8. Cosmetic refinement.

No verified database or transaction-rule defect was found in this audit. The first iteration therefore begins with the 320 px blocker, truthful workspace state, test reliability, and permission policy—not a visual rewrite.

## Finding priority matrix

| Priority                          | Findings                                 | Outcome                                                                              |
| --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| P0 — release blocker              | MF-01, MF-04, MF-11                      | Minimum width fits; data freshness is truthful; viewport tests are trustworthy       |
| P1 — next controlled iteration    | MF-02, MF-03, MF-05, MF-07, MF-08, MF-10 | Core tasks become direct, authorized, recoverable, and accessible                    |
| P2 — scale and desktop efficiency | MF-06, MF-12, MF-14, MF-15               | Histories scale; desktop comparison improves; page architecture becomes maintainable |
| P3 — refinement                   | MF-09, MF-13, MF-16, MF-17               | Safe-area/motion support, cleaner visual system, validated one-handed navigation     |

## Quick wins

These are small, coherent changes suitable for the first approved PR. They do not change API payloads or business transactions.

| Change                                                                                              | Findings             | Effort | Verification                                           |
| --------------------------------------------------------------------------------------------------- | -------------------- | -----: | ------------------------------------------------------ |
| Fix 320 px dashboard control overflow                                                               | MF-01                |      S | Six-width overflow assertion and 200% zoom             |
| Normalize workspace modes and dashboard labels                                                      | MF-04, MF-15         |      S | Delayed/success/failure/refresh tests                  |
| Repair route-specific Playwright waits and add all reference widths                                 | MF-11                |      S | Screenshots contain expected `h1` and live/error state |
| Convert access-denied and visual section titles to semantic headings                                | MF-08                |      S | Accessibility tree/heading-order test                  |
| Add reduced-motion and safe-area primitives                                                         | MF-09                |      S | Emulated media/device checks                           |
| Add roles/status semantics to persistent banners                                                    | MF-10                |      S | Screen-reader/DOM role assertions                      |
| Remove unused scaffold files after import check                                                     | Architecture cleanup |      S | Build and route tests                                  |
| Correct formatter failures in owned source/test files; decide whether to format the supplied prompt | Quality gate         |      S | `npm run lint:check`                                   |

## Controlled implementation sequence

### Iteration 0 — Approval and baseline

Purpose: prevent UX work from encoding the wrong permissions or task order.

1. Review the finding register with owner, operations, warehouse/distribution, and finance representatives.
2. Approve a capability matrix covering route visibility, workspace reads, writes, settings, and reports.
3. Observe or interview at least one user per operational role about top destinations and interruption patterns.
4. Capture production-like row counts and payload sizes without exposing business data.
5. Freeze the existing six write payload contracts and retry semantics as regression fixtures.

Exit criteria:

- Deliberate role asymmetries are documented.
- Bottom navigation is approved or rejected based on role frequency.
- Draft retention/privacy rules are approved.
- Baseline screenshots and performance measurements are stored.

### Iteration 1 — Mobile blockers and state truth

Scope:

- MF-01: dashboard overflow.
- MF-04/MF-15: explicit loading/live/unavailable/refreshing state.
- MF-08/MF-09/MF-10: low-risk accessibility foundations.
- MF-11: reliable six-width browser coverage.

Files likely touched: `IndexPage.vue`, `dashboard.js`, main workspace pages, `app.scss`, `UnauthorizedPage.vue`, browser tests, and a small shared workspace-state component/composable.

Do not change server business functions, form payloads, or role rules in this iteration.

Exit criteria:

- Every route fits at 320, 375, 430, 768, 1024, and 1440 px with destination content settled.
- Initial load never masquerades as empty/live data.
- Keyboard and reduced-motion smoke tests pass.
- Existing domain and six-form payload tests remain green.

### Iteration 2 — Direct task entry and local navigation

Scope:

- Replace large route heroes with compact `PageHeader`.
- Move catalogue/partner management to an overflow/settings entry.
- Replace scrolling phone tabs with a task/review selector.
- Encode selected view in query or child-route state.
- Keep full `QTabs` where all items fit at tablet/desktop.

Pilot on Operations because it contains both a short repeatable form and a longer production form. Do not refactor all modules simultaneously.

Exit criteria:

- Receipt and batch entry are reachable within the first 600 px at 375 px.
- Every task has a direct URL and correct browser back behavior.
- No action disappears for an authorized role.
- Current input rules, recipes, FIFO selection, retry locks, and post-save refresh remain intact.

### Iteration 3 — Critical form recovery and reconciliation clarity

Scope:

- Add a user-scoped session draft contract for production, stock issue, reconciliation, remittance, and expense.
- Add dirty-navigation warnings.
- Add reconciliation opening/accounted/unaccounted line feedback.
- Standardize form error summaries and focus behavior.
- Add success confirmation with next actions.

Pilot reconciliation first because it has the highest input load and business risk.

Exit criteria:

- Same-user refresh/route round-trip restores the draft.
- Successful save and sign-out clear it.
- A different user on the same browser cannot see it.
- Network-uncertain retry persistence still uses the original body/key and remains distinct from drafts.

### Iteration 4 — Permission and settings architecture

Scope:

- Implement the approved capability matrix.
- Centralize client capability helpers; test against server constants/contracts.
- Give operations managers a valid catalogue settings path if approved.
- Align drawer, optional bottom nav, router metadata, page actions, API reads, and writes.

Exit criteria:

- Automated role matrix covers all seven roles.
- Direct URL access and visible navigation agree.
- Server remains the final authorization boundary.
- No unauthorized data is rendered or fetched by normal UI flows.

### Iteration 5 — Scalable workspace data and desktop records

Scope:

- Split workspace summaries/reference data from histories.
- Add server-side pagination, date windows, and filters.
- Introduce `ResponsiveRecordView` one dataset at a time.
- Start with purchases and dispatches, then batches/movements, then finance records.
- Fetch nested line detail on demand.

This is the first iteration that changes read API contracts. Keep writes unchanged.

Exit criteria:

- Initial workspaces do not download complete history.
- Mobile cards and desktop tables use identical data/action definitions.
- Sort/filter/page are server-authoritative and role checked.
- Production-like payload and interaction budgets pass.

### Iteration 6 — Visual system consolidation

Scope:

- Introduce semantic color, spacing, radius, elevation, and typography tokens.
- Flatten routine surfaces and remove decorative gradients/shadows from task pages.
- Standardize status vocabulary, empty states, metric strips, and action placement.
- Refine select behavior for desktop.
- Remove duplicated formatters and low-value environment/role diagnostics from primary Admin UI.

Do this after task structure stabilizes so visual cleanup does not disguise unresolved workflow issues.

Exit criteria:

- Token audit finds no unexplained repeated magic values in migrated surfaces.
- Contrast and zoom tests pass.
- Forms and exception states dominate visual hierarchy.
- Brand recognition remains intact without landing-page styling.

## Component extraction order

1. `WorkspaceState` and workspace request composable.
2. `PageHeader`.
3. `TaskSelector` with URL state.
4. `FormActionBar` integrating `WriteStatus`.
5. Reconciliation line editor and draft composable.
6. `ResponsiveRecordView` after paginated API design is stable.
7. Shared formatters and capability helpers.

Avoid extracting a component before at least two real consumers demonstrate the shared behavior, except for the high-risk reconciliation editor which merits isolation for testing.

## Dependencies and risks

| Risk                                                      | Mitigation                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| UI simplification accidentally removes a business control | Freeze payloads and server rules; compare field/action inventory before and after                   |
| Permission cleanup changes intended visibility            | Owner-approved matrix and per-role browser/API tests                                                |
| Draft storage leaks between shared-device users           | Key by authenticated user; clear on sign-out; store only inputs; define expiry                      |
| Pagination hides records needed for reconciliation        | Keep open issue lines task-specific and server filtered; do not paginate away selected/open context |
| Responsive card/table modes diverge                       | Single row/action definition and shared tests                                                       |
| Visual refactor expands scope                             | Migrate one workflow/surface per PR; no framework or dependency migration                           |
| Existing dirty worktree content is overwritten            | Preserve the user-owned `prompt-audit.md`; isolate audit implementation commits                     |

## Definition of done per change

Every iteration must:

1. Document existing and intended behavior.
2. Preserve API payloads and business rules unless the approved scope explicitly changes reads.
3. Test 320, 375, 430, 768, 1024, and 1440 px.
4. Verify keyboard, touch, focus, live announcements, reduced motion, and orientation where relevant.
5. Run typecheck, unit/domain tests, browser tests, lint, and build.
6. Compare role behavior for all affected roles.
7. Confirm no unintended horizontal overflow.
8. Record before/after evidence and any remaining assumption.

## Approval gates

- **Gate A:** Approve findings, role matrix work, and mobile navigation research.
- **Gate B:** Approve Iteration 1 before any application code change.
- **Gate C:** Review the Operations pilot before applying its pattern to Retail/Finance.
- **Gate D:** Approve draft privacy/retention before persistence work.
- **Gate E:** Approve read API pagination contract before server/query changes.
