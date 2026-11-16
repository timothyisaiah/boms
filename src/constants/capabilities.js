// Single client-side source of truth for what each BOMS role can see and do.
//
// The server (server/auth.ts, server/workspaces.ts, api/*.ts) remains the
// authorization boundary. This module mirrors those constants so the router,
// navigation and page actions agree with what the API will accept, and
// tests/capabilities.test.mjs fails if the two drift apart. Deliberate
// differences (a role may read a workspace through the API but has no route to
// it) are listed in ROUTE_ASYMMETRIES and docs/audits/capability-matrix.md.
//
// Keep this file free of Vue/Quasar imports so Node tests can load it.
import { normalizeRole } from './roles.js'

export const ROLES = Object.freeze([
  'admin_owner',
  'operations_manager',
  'production_staff',
  'warehouse_staff',
  'sales_or_distribution_staff',
  'finance_accountant',
  'read_only_management'
])

const only = (...roles) => Object.freeze(roles)
const allExcept = role => Object.freeze(ROLES.filter(value => value !== role))

// Mirrors of server/auth.ts role sets.
export const ROLE_SETS = Object.freeze({
  ALL: ROLES,
  SUPPLY: allExcept('sales_or_distribution_staff'),
  RETAIL: allExcept('production_staff'),
  REVIEW: only(
    'admin_owner',
    'operations_manager',
    'sales_or_distribution_staff',
    'finance_accountant',
    'read_only_management'
  ),
  FINANCE: only(
    'admin_owner',
    'operations_manager',
    'finance_accountant',
    'read_only_management'
  ),
  FINANCE_WRITE: only(
    'admin_owner',
    'operations_manager',
    'finance_accountant'
  ),
  SETTINGS: only('admin_owner', 'operations_manager'),
  OWNER: only('admin_owner')
})
const { ALL, SUPPLY, RETAIL, REVIEW, FINANCE_WRITE, SETTINGS, OWNER } =
  ROLE_SETS

// Mirror of server/workspaces.ts `workspaceRoles` (GET /api/workspace?name=).
export const WORKSPACE_READ_ROLES = Object.freeze({
  dashboard: ALL,
  operations: SUPPLY,
  retail: RETAIL,
  finance: REVIEW,
  settings: SETTINGS,
  home: allExcept('read_only_management')
})

// Other read endpoints: api/materials.ts, api/variants.ts, api/partners.ts
// (GET, by kind) and api/users.ts.
export const API_READ_ROLES = Object.freeze({
  materials: SUPPLY,
  variants: SUPPLY,
  'partners:supplier': SUPPLY,
  'partners:retailer': RETAIL,
  users: OWNER
})

// Mirror of server/auth.ts `WRITE_ROLES`, keyed by the action names passed to
// writeAction() in src/services/writes.js (POST /api/write?action=). Supplier
// and retailer creation go through POST /api/partners with the same role sets.
export const WRITE_ROLES = Object.freeze({
  materials: only('admin_owner', 'operations_manager', 'warehouse_staff'),
  variants: only('admin_owner', 'operations_manager'),
  suppliers: only('admin_owner', 'operations_manager', 'warehouse_staff'),
  retailers: only(
    'admin_owner',
    'operations_manager',
    'warehouse_staff',
    'sales_or_distribution_staff'
  ),
  purchases: only('admin_owner', 'operations_manager', 'warehouse_staff'),
  production: only('admin_owner', 'operations_manager', 'production_staff'),
  'production-run': only(
    'admin_owner',
    'operations_manager',
    'production_staff'
  ),
  'direct-sales': only(
    'admin_owner',
    'operations_manager',
    'warehouse_staff',
    'sales_or_distribution_staff'
  ),
  'retailer-checkins': FINANCE_WRITE,
  'variant-barcode': SETTINGS,
  'stock-issues': only(
    'admin_owner',
    'operations_manager',
    'warehouse_staff',
    'sales_or_distribution_staff'
  ),
  reconciliations: FINANCE_WRITE,
  returns: FINANCE_WRITE,
  remittances: FINANCE_WRITE,
  expenses: FINANCE_WRITE,
  prices: SETTINGS,
  recipes: SETTINGS
})

// Non-write capabilities that are not tied to a single API action.
export const OTHER_CAPABILITIES = Object.freeze({
  // Catalogue settings page: variant prices and recipe defaults.
  'settings:catalogue': SETTINGS,
  // User accounts and role assignment (api/users.ts).
  'admin:users': OWNER
})

// Every route a signed-in user can navigate to. `roles` is the policy; for the
// existing routes it preserves the visibility BOMS already had. `workspace`
// is the server read the page depends on, or null when it reads another API.
// `group: 'primary'` destinations are bottom-navigation candidates; 'settings'
// destinations live in the drawer only.
export const DESTINATIONS = Object.freeze([
  {
    // One-tap daily work: make jars, stock in, give, sell, check in.
    name: 'home',
    path: '/home',
    label: 'Home',
    caption: 'Make, give, sell and check in',
    icon: 'home',
    title: 'Home',
    group: 'primary',
    workspace: 'home',
    roles: allExcept('read_only_management')
  },
  {
    name: 'dashboard',
    path: '/',
    label: 'Dashboard',
    caption: 'KPIs, monthly review, and watchlists',
    icon: 'space_dashboard',
    title: 'Dashboard',
    group: 'primary',
    workspace: 'dashboard',
    roles: ALL,
    // Any signed-in user, including one still awaiting a role assignment.
    anyAuthenticated: true
  },
  {
    name: 'operations',
    path: '/operations',
    label: 'Operations',
    caption: 'Purchases, lots, and batches',
    icon: 'warehouse',
    title: 'Operations',
    group: 'primary',
    workspace: 'operations',
    roles: only(
      'admin_owner',
      'operations_manager',
      'production_staff',
      'warehouse_staff'
    )
  },
  {
    name: 'retail',
    path: '/retail',
    label: 'Distribution',
    caption: 'Warehouse stock and dispatch',
    icon: 'storefront',
    title: 'Distribution',
    group: 'primary',
    workspace: 'retail',
    roles: only(
      'admin_owner',
      'operations_manager',
      'warehouse_staff',
      'sales_or_distribution_staff',
      'finance_accountant'
    )
  },
  {
    name: 'finance',
    path: '/finance',
    label: 'Finance',
    caption: 'Reconciliation, cash, and margin',
    icon: 'payments',
    title: 'Finance',
    group: 'primary',
    workspace: 'finance',
    roles: only(
      'admin_owner',
      'operations_manager',
      'finance_accountant',
      'read_only_management'
    )
  },
  {
    name: 'settings',
    path: '/settings',
    label: 'Catalogue settings',
    caption: 'Variant prices and recipe defaults',
    icon: 'tune',
    title: 'Catalogue settings',
    group: 'settings',
    workspace: 'settings',
    roles: SETTINGS
  },
  {
    name: 'admin',
    path: '/admin',
    label: 'Users & access',
    caption: 'Staff accounts and roles',
    icon: 'manage_accounts',
    title: 'Users & access',
    group: 'settings',
    workspace: null,
    roles: OWNER
  }
])

// Where each role lands after sign-in. Must be one of its routes.
export const LANDING_ROUTES = Object.freeze({
  admin_owner: '/home',
  operations_manager: '/home',
  production_staff: '/home',
  warehouse_staff: '/home',
  sales_or_distribution_staff: '/home',
  finance_accountant: '/finance',
  read_only_management: '/finance'
})

// Routes hidden from a role although the server lets it read the backing
// workspace. These are pending an owner decision; see capability-matrix.md.
export const ROUTE_ASYMMETRIES = Object.freeze([
  { role: 'finance_accountant', route: 'operations', workspace: 'operations' },
  {
    role: 'read_only_management',
    route: 'operations',
    workspace: 'operations'
  },
  { role: 'read_only_management', route: 'retail', workspace: 'retail' },
  {
    role: 'sales_or_distribution_staff',
    route: 'finance',
    workspace: 'finance'
  }
])

export const MAX_BOTTOM_NAV_ITEMS = 4
export const MORE_ITEM = Object.freeze({
  name: 'more',
  label: 'More',
  icon: 'menu',
  more: true
})

const CAPABILITY_ROLES = (() => {
  const map = {}
  for (const [name, roles] of Object.entries(WORKSPACE_READ_ROLES))
    map[`read:${name}`] = roles
  for (const [name, roles] of Object.entries(API_READ_ROLES))
    map[`read:${name}`] = roles
  for (const [name, roles] of Object.entries(WRITE_ROLES))
    map[`write:${name}`] = roles
  for (const destination of DESTINATIONS)
    map[`route:${destination.name}`] = destination.roles
  Object.assign(map, OTHER_CAPABILITIES)
  return Object.freeze(map)
})()

export const CAPABILITIES = Object.freeze(Object.keys(CAPABILITY_ROLES))

/** Roles allowed a capability, or undefined for an unknown capability. */
export function rolesFor(capability) {
  return CAPABILITY_ROLES[capability]
}

/**
 * Whether `role` has `capability`. Capabilities are namespaced strings:
 * `route:<name>`, `read:<workspace|api>`, `write:<action>` (the writeAction
 * name), `settings:catalogue`, `admin:users`. Unknown capabilities and
 * missing roles are denied.
 */
export function can(role, capability) {
  const normalized = normalizeRole(role)
  const roles = CAPABILITY_ROLES[capability]
  if (!normalized || !roles) return false
  return roles.includes(normalized)
}

/** Shortcut for `can(role, 'write:' + action)`. */
export function canWrite(role, action) {
  return can(role, `write:${action}`)
}

export function destinationByName(name) {
  return DESTINATIONS.find(destination => destination.name === name)
}

/** Destinations (drawer order) the role may navigate to. */
export function routesForRole(role) {
  return DESTINATIONS.filter(
    destination =>
      destination.anyAuthenticated || can(role, `route:${destination.name}`)
  )
}

/**
 * Bottom navigation items for a list of primary destinations: at most
 * MAX_BOTTOM_NAV_ITEMS; when there are more, the last slot becomes "More"
 * (opens the drawer). Fewer than two destinations hide the bar entirely.
 */
export function bottomNavItems(destinations) {
  if (destinations.length < 2) return []
  if (destinations.length <= MAX_BOTTOM_NAV_ITEMS) return [...destinations]
  return [...destinations.slice(0, MAX_BOTTOM_NAV_ITEMS - 1), MORE_ITEM]
}

/** The role's primary destinations as shown in the bottom navigation. */
export function primaryDestinations(role) {
  return bottomNavItems(
    routesForRole(role).filter(destination => destination.group === 'primary')
  )
}

export function defaultRouteForRole(role) {
  return LANDING_ROUTES[normalizeRole(role)] ?? '/'
}
