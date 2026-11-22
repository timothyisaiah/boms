# MASTER PROMPT: Quasar + Vue.js Mobile-First Application Audit and UX Refactoring

## Role

Act as a Principal UX/UI Designer, Mobile-First Product Architect, Senior Vue.js/Quasar Engineer, Business Process Analyst, and Software Quality Auditor.

Your assignment is to conduct a deep, evidence-based audit of an existing Quasar + Vue.js application and develop a strategy to transform it into a clean, consistent, intuitive, mobile-first product that progressively adapts to tablet and desktop environments.

This is not a superficial UI redesign. The audit must address the application's architecture, user journeys, business processes, information architecture, component design, usability, accessibility, responsiveness, and performance.

**Primary objective:** Eliminate design slop, unnecessary complexity, inconsistent workflows, redundant interactions, and inefficient navigation while preserving business functionality and data integrity.

## Non-Negotiable Design Principles

1. **Mobile first, desktop enhanced.** Design the smallest supported viewport first, then progressively enhance for larger screens.
2. **Task completion over visual decoration.** Optimize for users accomplishing real work with minimal friction.
3. **Consistency over novelty.** Similar actions must look and behave consistently throughout the application.
4. **Clarity over density.** Prioritize essential information without hiding critical functionality.
5. **Simplicity over unnecessary abstraction.** Remove redundant UI patterns and avoid overengineering.
6. **Native Quasar conventions.** Reuse the framework's existing responsive utilities, components, and patterns.
7. **Accessibility by default.** Support keyboard, touch, screen readers, and appropriate contrast.
8. **Business logic preservation.** Never compromise permissions, validation, data integrity, or auditability to simplify the UI.

---

# PHASE 1: Application Discovery

Inspect the repository before proposing changes.

Determine:

- Vue version and Composition API versus Options API usage.
- Quasar version and application mode (SPA, SSR, PWA, Capacitor, or Cordova).
- Routing structure and navigation guards.
- Layout architecture (`QLayout`, `QHeader`, `QDrawer`, `QPageContainer`, `QFooter`).
- State management (Pinia, Vuex, or alternatives).
- API clients, data-fetching, and caching patterns.
- Authentication and authorization.
- Existing reusable components.
- Global CSS, SCSS, Quasar variables, and theme configuration.
- Responsive breakpoint usage.
- Form validation and submission patterns.
- Table and pagination implementations.
- Notification, dialog, and loading conventions.
- Testing infrastructure and build configuration.

Identify architectural inconsistencies and duplicated implementations.

Create a complete inventory of pages, routes, modules, components, and significant workflows.

Do not assume that the application is mobile-friendly simply because it uses Quasar.

**Deliverable:** Application architecture map and feature inventory.

---

# PHASE 2: Mobile-First User Journey Audit

Treat the mobile experience as the primary reference.

For every major workflow, evaluate how a user completes the task on a smartphone.

## 2.1 Workflow Discovery

Trace:

- Authentication and onboarding.
- Navigation between modules.
- Dashboard interactions.
- Search and record retrieval.
- Record creation and editing.
- Multi-step forms.
- Approvals and status changes.
- Document upload and attachment management.
- Transaction processing.
- Reporting and exports.
- Administrative operations.
- Error handling and recovery.

For each workflow, document:

- Entry point.
- User goal.
- Required information.
- Screen sequence.
- Number of actions.
- Scroll requirements.
- Context switching.
- Validation and feedback.
- Success and failure states.
- Recovery mechanisms.

## 2.2 Mobile Workflow Optimization

Identify workflows where mobile users experience:

- Excessive scrolling.
- Unnecessary page transitions.
- Difficult-to-reach controls.
- Repeated data entry.
- Overly complicated forms.
- Excessive dialogs.
- Hidden or ambiguous actions.
- Small touch targets.
- Unnecessary horizontal scrolling.
- Poor keyboard interaction.
- Loss of entered data.
- Context-dependent information that disappears between screens.

Recommend ways to reduce friction while preserving required business controls.

Prioritize one-handed operation where practical, especially for frequently used actions.

Do not remove important validation or confirmations merely to reduce tap counts.

**Deliverable:** Current and proposed mobile user journey maps.

---

# PHASE 3: Responsive Architecture Audit

Audit the application's responsive behavior using the following reference viewport widths.

| Viewport | Width | Primary concern |
|---|---|---|
| Small mobile | 320px | Minimum supported usability |
| Mobile | 375px | Primary design baseline |
| Large mobile | 430px | Comfortable phone layout |
| Tablet | 768px | Intermediate layout |
| Small desktop | 1024px | Expanded navigation and content |
| Desktop | 1440px | Efficient use of horizontal space |

These are testing reference sizes, not mandatory breakpoint definitions. Use the application's configured Quasar breakpoints and content-driven layout requirements.

## 3.1 Mobile Layout

Inspect:

- Content width and horizontal overflow.
- Page padding and spacing.
- Header height and navigation.
- Sticky and fixed elements.
- Safe-area handling.
- Virtual keyboard interactions.
- Form layouts.
- Button placement.
- Card dimensions.
- Table alternatives.
- Modal behavior.
- Typography and readability.

No essential workflow should depend on desktop-only interactions.

## 3.2 Tablet and Desktop Enhancement

On larger screens, progressively introduce:

- Multi-column layouts where appropriate.
- Persistent navigation.
- More visible contextual actions.
- Side-by-side detail panels.
- Expanded data tables.
- Advanced filtering controls.
- Higher information density.
- More efficient use of available screen space.

Do not simply stretch mobile components to fill desktop screens.

Desktop should provide increased efficiency, not a completely different interaction model.

## 3.3 Quasar-Specific Implementation Review

Evaluate the use of:

- `$q.screen` and Quasar screen breakpoints.
- Quasar responsive visibility classes.
- `row`, `col-*`, and responsive grid utilities.
- `QLayout`, `QDrawer`, and `QPage`.
- `QToolbar` and `QTabs`.
- `QBottomNavigation` where appropriate.
- `QDialog` and `QMenu`.
- `QForm`, `QInput`, and `QSelect`.
- `QTable`, `QVirtualScroll`, and `QList`.
- `QBtn`, `QBtnDropdown`, and `QFab`.
- `QSkeleton`, `QBanner`, and `QNotify`.

Avoid unnecessary JavaScript-driven responsiveness when CSS is sufficient.

Use `$q.screen` for behavioral changes that genuinely require JavaScript.

Prefer one coherent implementation with responsive adaptations over maintaining separate mobile and desktop versions of the same workflow.

---

# PHASE 4: Design Slop Elimination

Perform a component-by-component and screen-by-screen audit.

Identify:

- Arbitrary margins and padding.
- Inconsistent typography.
- Random color choices.
- Excessive shadows and borders.
- Unnecessary nested cards.
- Inconsistent button dimensions.
- Duplicated action controls.
- Unnecessary icons.
- Inconsistent status badges.
- Poor visual hierarchy.
- Excessive animations.
- Overly complicated dashboards.
- Inconsistent forms.
- Conflicting dialog patterns.
- Unnecessary explanatory text.
- Decorative elements without functional value.

Pay particular attention to generic AI-generated dashboard patterns, excessive metric cards, decorative gradients, redundant section headings, and components that create visual noise.

For every element, decide whether to:

**Keep, Refine, Consolidate, Remove, or Investigate.**

Do not remove functionality based on aesthetics alone.

The intended visual direction is:

- Clean and professional.
- Minimal but not empty.
- Information-focused.
- Consistent and predictable.
- Appropriate for operational software.
- Optimized for readability and task completion.

Avoid making the interface look like a marketing landing page.

---

# PHASE 5: Mobile-First Navigation

Audit the complete navigation architecture.

### Mobile

Evaluate whether the application should use:

- Compact top app bar.
- Contextual page titles.
- Bottom navigation for a small number of primary destinations.
- Navigation drawer for secondary modules.
- Contextual action menus.
- Back navigation.
- Search and quick actions.

Do not introduce bottom navigation automatically. Determine whether it suits the number of modules, navigation hierarchy, and frequency of user tasks.

Avoid overcrowded headers and multiple competing navigation systems.

### Desktop

Evaluate:

- Persistent or collapsible side navigation.
- Contextual breadcrumbs.
- Page-level actions.
- Search placement.
- Module grouping.
- Multi-panel workflows.

Maintain consistent route names, navigation labels, and behavior across device sizes.

**Deliverable:** Proposed mobile and desktop navigation architecture.

---

# PHASE 6: Forms and Data Entry

Treat forms as a priority because mobile data entry is often the most demanding part of operational applications.

Audit:

- Field sequence and grouping.
- Appropriate mobile keyboard types.
- Autofill and autocomplete.
- Required versus optional fields.
- Conditional fields.
- Dependent selects.
- Date and numeric inputs.
- Inline validation.
- Error placement.
- Draft preservation.
- Submission feedback.
- Duplicate submission protection.
- Scroll-to-error behavior.
- Keyboard obstruction of controls.
- Sticky submission actions where appropriate.

Prefer a single-column layout on mobile.

Use multi-column layouts on desktop only when field relationships and reading order justify them.

For long forms, evaluate whether progressive disclosure or a multi-step workflow would reduce cognitive load.

Do not split forms into multiple steps without a clear usability benefit.

---

# PHASE 7: Mobile-First Data Tables

Audit every `QTable` implementation.

On mobile, evaluate the best presentation for the task:

- Compact list.
- Structured record cards.
- Expandable rows.
- Responsive table.
- Detail-on-demand.
- Search-first interface.

Do not automatically convert every table into cards.

Preserve important table capabilities:

- Sorting.
- Filtering.
- Search.
- Pagination.
- Selection.
- Bulk actions.
- Row-level actions.
- Export where required.

For desktop, use available horizontal space to provide efficient tabular views.

Where mobile and desktop presentations differ, preserve consistent data, actions, permissions, and state.

Avoid duplicate business logic.

**Deliverable:** Table-by-table responsive strategy.

---

# PHASE 8: Design System and Component Standardization

Establish or refine a reusable design system based on existing Quasar capabilities.

Standardize:

- Typography.
- Spacing.
- Colors and semantic states.
- Buttons.
- Inputs.
- Cards.
- Tables.
- Dialogs.
- Navigation.
- Status indicators.
- Empty states.
- Loading states.
- Notifications.
- Page layouts.
- Action placement.

Use Quasar theme variables and shared design tokens wherever practical.

Avoid arbitrary inline styles and duplicated CSS rules.

Identify components that should be consolidated into reusable abstractions.

Do not create a generic component for every minor variation.

Document component responsibilities, variants, responsive behavior, and interaction states.

---

# PHASE 9: Accessibility and Performance

Evaluate mobile and desktop experiences against WCAG 2.2 AA where applicable.

Check:

- Touch target sizing.
- Keyboard navigation.
- Focus visibility.
- Screen-reader labels.
- Semantic structure.
- Color contrast.
- Reduced-motion support.
- Error identification.
- Orientation changes.
- Text scaling.
- Safe-area behavior.

Assess:

- Initial loading performance.
- Route-level code splitting.
- Component rerenders.
- API request duplication.
- Large tables and lists.
- Image optimization.
- Layout shifts.
- Mobile network performance.
- Expensive watchers and computed properties.
- Unnecessary client-side processing.

Measure performance where tools are available and identify unverified concerns separately.

---

# PHASE 10: Audit Reporting and Prioritization

For each finding, report:

- Finding ID.
- Module and route.
- Component or file.
- Affected viewport.
- Category.
- Observed problem.
- Evidence.
- User impact.
- Business impact.
- Severity.
- Proposed solution.
- Implementation effort.
- Dependencies.
- Acceptance criteria.

Prioritize issues in this order:

1. Broken workflows and business-rule violations.
2. Mobile usability blockers.
3. Accessibility failures.
4. Inefficient user journeys.
5. Navigation and information architecture.
6. Component and design inconsistencies.
7. Performance problems.
8. Cosmetic refinements.

Separate quick wins from architectural improvements.

---

# PHASE 11: Implementation Strategy

Do not immediately modify the application.

First deliver the audit findings and proposed improvements.

Once approved, implement changes in controlled iterations.

For every change:

1. Establish the existing behavior.
2. Define the intended mobile experience.
3. Define tablet and desktop enhancements.
4. Identify reusable Quasar components.
5. Preserve business rules and API contracts.
6. Implement the smallest coherent improvement.
7. Test on all reference viewport sizes.
8. Verify keyboard and touch interactions.
9. Run existing automated tests.
10. Check for visual and functional regressions.

Avoid unnecessary dependencies, framework migrations, or broad rewrites.

Do not modify unrelated modules.

---

# REQUIRED DELIVERABLES

Create the following Markdown documents under `docs/audits/`:

1. `application-architecture.md`
2. `user-journey-audit.md`
3. `mobile-first-ux-audit.md`
4. `design-slop-report.md`
5. `responsive-design-strategy.md`
6. `design-system.md`
7. `implementation-roadmap.md`
8. `validation-checklist.md`

Where useful, include Mermaid diagrams, component inventories, workflow comparisons, and file references.

Every recommendation must be grounded in observed application behavior or code evidence.

Clearly distinguish verified defects, design recommendations, and assumptions requiring validation.

# SUCCESS CRITERIA

The application should ultimately achieve:

- Every essential workflow is usable on mobile.
- No unintended horizontal overflow at supported widths.
- Clear and consistent navigation.
- Reduced unnecessary taps and screen transitions.
- Predictable forms and validation.
- Readable and usable operational data.
- Consistent Quasar components and design tokens.
- Reduced duplication and design slop.
- Improved accessibility.
- Desktop layouts that enhance productivity.
- Preserved business logic and data integrity.
- Maintainable, testable frontend architecture.

# EXECUTION INSTRUCTION

Begin with a read-only repository audit.

Map the application architecture and user journeys before recommending changes.

**Mobile is the primary design baseline. Desktop is the progressive enhancement.**

Do not start implementation until the audit report and prioritized roadmap have been reviewed and approved.