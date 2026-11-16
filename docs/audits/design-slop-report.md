# Design slop report

Audit date: 15 November 2026

## Visual direction assessment

The current UI is polished but over-styled for operational software. Warm Beecone branding is appropriate; the repeated marketing-like hero panels, radial gradients, large shadows, oversized radii, nested surfaces, and metric-card stacks are not. The redesign should keep the recognizable honey/forest palette and Montserrat typography while making forms, exceptions, and records visibly primary.

## Screen-by-screen disposition

| Screen / element                      | Decision                     | Evidence                                                                                      | Direction                                                                                                        |
| ------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Main header                           | Refine                       | Mobile shows brand only; desktop duplicates brand, route context, role, user, email, sign out | Compact mobile title; keep identity in drawer; simplify desktop metadata                                         |
| Drawer                                | Keep / refine                | Clear role-filtered groups and captions                                                       | Retain for secondary navigation; align labels with route titles; add role-aware bottom nav only after validation |
| Page hero                             | Consolidate                  | 165–616 px high; gradients/shadow/radius; contains secondary actions                          | Replace with `PageHeader`: eyebrow optional, `h1`, one-line context, primary action, overflow                    |
| Metric cards                          | Consolidate                  | Three/four full cards before tasks; often counts rather than decisions                        | Use a compact metric strip; show exception/action metrics first                                                  |
| Operations hero actions               | Remove from hero             | Six catalogue/partner/refresh/back actions dominate phone entry                               | Primary “New receipt”/“New batch”; move management to overflow/settings                                          |
| Horizontal module tabs                | Refine                       | 2/5 visible on 320/375 px                                                                     | Mobile task menu grouped by Do/Review; full tabs on tablet/desktop                                               |
| Nested workspace/card/block surfaces  | Consolidate                  | `surface-card` → tab panel → `operations-tab-block` → list/line cards                         | One containing surface plus rows; reserve nested card for independently actionable entity                        |
| Form line cards                       | Keep / refine                | They establish repeated-line boundaries                                                       | Reduce radius/padding; keep remove action and live line summary                                                  |
| Sticky form footer                    | Keep / refine                | Supports long forms and one-handed submission                                                 | Add safe-area padding, error summary, and compact totals                                                         |
| Status chips                          | Standardize                  | Many utility color combinations and action-like “Collect” status                              | Semantic status vocabulary and fixed tone mapping; avoid verbs unless interactive                                |
| Empty states                          | Refine                       | Helpful text but often buried in decorated containers                                         | Short reason + permitted next action; distinguish empty/loading/error                                            |
| Loading states                        | Investigate / standardize    | Main pages show empty/unavailable values while loading                                        | Skeleton/previous-data state plus accessible status                                                              |
| Dashboard trend                       | Keep, progressive disclosure | Useful comparison; already collapsed on phone                                                 | Default collapsed on phone; reduce decorative nested focus panel                                                 |
| Dashboard watchlists                  | Keep / refine                | Action-relevant operational content                                                           | Move before generic metrics where role research supports it; add real contextual actions                         |
| Report expansion sections             | Keep                         | Appropriate progressive disclosure                                                            | Preserve; tighten headings and period context                                                                    |
| Report mobile cards / desktop table   | Keep                         | Correct task-driven responsive pattern                                                        | Reuse for comparison-heavy operational records                                                                   |
| Operational history cards on desktop  | Refine                       | No sort/filter/page; wide cards                                                               | Desktop tables with shared data/actions; mobile cards remain                                                     |
| Management dialogs                    | Keep / refine                | Full-screen on phones and searchable                                                          | Move entry points; add unsaved-change protection where needed                                                    |
| Environment/session card              | Remove or demote             | Technical status consumes primary Admin space                                                 | Put under diagnostics; keep role/account essentials only                                                         |
| Role matrix with raw role values      | Refine                       | Useful to developers, low-value to daily owner task                                           | Document permissions in plain language; hide raw identifiers from default UI                                     |
| Unused `SecondPage` / `EssentialLink` | Remove after check           | No active route/import                                                                        | Delete in implementation cleanup                                                                                 |

## Token inconsistencies

The application defines brand variables and Quasar semantic colors, then mixes them with `brown-*`, `amber-*`, `green-*`, `blue-*`, `grey-*`, hard-coded hex values, and numerous rgba values. Radius, elevation, and spacing values are repeated rather than named. This makes visual hierarchy hard to tune globally.

Recommended token set:

- semantic colors: canvas, surface, surface-subtle, text, text-muted, border, primary, success, warning, danger, info;
- spacing: 4, 8, 12, 16, 24, 32;
- radii: 8 for controls, 12 for cards, 16 for major containers, full for pills;
- elevation: none, overlay, sticky only;
- typography: page title, section title, body, label, caption, tabular number;
- layout: page max width, mobile gutter, desktop gutter, sticky action height, safe-area padding.

## Repetition and component consolidation

Consolidate only patterns with multiple proven consumers:

1. `PageHeader` for compact title, context, primary action, and overflow.
2. `WorkspaceState` for loading/live/unavailable/error semantics.
3. `MetricStrip` for compact decision metrics.
4. `FormActionBar` for totals, validation summary, retry state, and sticky submit.
5. `ResponsiveRecordView` for mobile cards and desktop tables using one data/action definition.
6. Shared money/date/quantity formatters.
7. A capability helper derived from the approved role matrix.

Do not create a universal card, universal form field, or schema-driven form system. Purchase, production, issue, and reconciliation lines have different business semantics and should remain workflow-specific.

## Copy and hierarchy cleanup

- Remove repeated “Workspace / Forms and records” framing when the route title and task selector already establish context.
- Prefer task nouns and outcomes: “Record receipt,” “Create batch,” “Issue stock,” “Reconcile stock,” “Record payment.”
- Replace technical “Preview mode” with “Data unavailable” and an action.
- Replace status verbs such as “Collect” with “Payment due”; add a separate action only when the user can perform it.
- Keep explanatory text where it protects a business rule, such as consignment, price effective date, or good-return restocking. Remove generic descriptions that restate a heading.

## Acceptance standard

A surface remains only when it creates grouping, affordance, state, or interaction value. Decorative separation alone is not sufficient. No mobile task should require scrolling through marketing-style content before the primary action, and desktop density should increase without changing the underlying workflow.
