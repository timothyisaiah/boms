// Run with `node --import tsx --test` so server .ts modules (and their
// `./x.js` specifiers) resolve. Keeps the client capability matrix in
// src/constants/capabilities.js aligned with the server authorization rules.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as server from '../server/auth.ts'
import { workspaceRoles } from '../server/workspaces.ts'
import { access } from '../server/projections.ts'
import routes from '../src/router/routes.js'
import {
  API_READ_ROLES,
  DESTINATIONS,
  LANDING_ROUTES,
  MAX_BOTTOM_NAV_ITEMS,
  ROLES,
  ROLE_SETS,
  ROUTE_ASYMMETRIES,
  WORKSPACE_READ_ROLES,
  WRITE_ROLES,
  bottomNavItems,
  can,
  canWrite,
  defaultRouteForRole,
  primaryDestinations,
  routesForRole
} from '../src/constants/capabilities.js'
import { ROLE_OPTIONS, getDefaultRouteForRole } from '../src/constants/roles.js'

const sorted = roles => [...roles].sort()
const same = (actual, expected, message) =>
  assert.deepEqual(sorted(actual), sorted(expected), message)

// Per-projection read rules, exported by server/projections.ts.

// Routes hidden from a role although the API would let it read the workspace.
// Pending owner decision: see docs/audits/capability-matrix.md.
const EXPECTED_ASYMMETRIES = [
  'finance_accountant:operations',
  'read_only_management:operations',
  'read_only_management:retail',
  'sales_or_distribution_staff:finance'
]

// Which route hosts the UI for each write action.
const WRITE_HOME = {
  materials: 'operations',
  variants: 'operations',
  suppliers: 'operations',
  purchases: 'operations',
  production: 'operations',
  retailers: 'retail',
  'stock-issues': 'retail',
  reconciliations: 'finance',
  returns: 'finance',
  remittances: 'finance',
  expenses: 'finance',
  prices: 'settings',
  recipes: 'settings',
  'production-run': 'home',
  'direct-sales': 'home',
  'retailer-checkins': 'home',
  'variant-barcode': 'home'
}

test('client role list matches server ALL_ROLES and the role picker', () => {
  assert.deepEqual([...ROLES], [...server.ALL_ROLES])
  assert.deepEqual(
    ROLE_OPTIONS.map(option => option.value),
    [...server.ALL_ROLES]
  )
})

test('client role sets mirror server/auth.ts', () => {
  same(ROLE_SETS.ALL, server.ALL_ROLES)
  same(ROLE_SETS.SUPPLY, server.SUPPLY)
  same(ROLE_SETS.RETAIL, server.RETAIL)
  same(ROLE_SETS.REVIEW, server.REVIEW)
  same(ROLE_SETS.FINANCE, server.FINANCE)
  same(ROLE_SETS.FINANCE_WRITE, server.FINANCE_WRITE)
})

test('workspace reads mirror server workspaceRoles', () => {
  same(Object.keys(WORKSPACE_READ_ROLES), Object.keys(workspaceRoles))
  for (const [name, roles] of Object.entries(workspaceRoles))
    same(WORKSPACE_READ_ROLES[name], roles, `workspace ${name}`)
})

test('API read rules mirror materials, variants, partners and users endpoints', () => {
  const source = file => readFileSync(file, 'utf8')
  const gate = roles =>
    new RegExp(`requireRole\\(await getSession\\(req\\), ${roles}\\)`)
  assert.match(source('api/materials.ts'), gate('SUPPLY'))
  assert.match(source('api/variants.ts'), gate('SUPPLY'))
  assert.match(
    source('api/partners.ts'),
    /parsedKind\.data === 'supplier' \? SUPPLY : RETAIL/
  )
  assert.match(source('api/users.ts'), gate("\\['admin_owner'\\]"))
  same(API_READ_ROLES.materials, server.SUPPLY)
  same(API_READ_ROLES.variants, server.SUPPLY)
  same(API_READ_ROLES['partners:supplier'], server.SUPPLY)
  same(API_READ_ROLES['partners:retailer'], server.RETAIL)
  same(API_READ_ROLES.users, ['admin_owner'])
})

test('write rules mirror server WRITE_ROLES and every action writeAction knows', () => {
  same(Object.keys(WRITE_ROLES), Object.keys(server.WRITE_ROLES))
  for (const [action, roles] of Object.entries(server.WRITE_ROLES))
    same(WRITE_ROLES[action], roles, `write ${action}`)
  const writes = readFileSync('src/services/writes.js', 'utf8')
  const persisted = writes
    .match(/for \(const action of \[([\s\S]*?)\]\)/)[1]
    .match(/'([^']+)'/g)
    .map(value => value.slice(1, -1))
  for (const action of persisted)
    assert.ok(WRITE_ROLES[action], `writes.js action ${action} has no rule`)
})

test('can() answers for all 7 roles exactly as the server would', () => {
  for (const role of server.ALL_ROLES) {
    for (const [name, roles] of Object.entries(workspaceRoles))
      assert.equal(can(role, `read:${name}`), roles.includes(role), name)
    for (const [action, roles] of Object.entries(server.WRITE_ROLES)) {
      assert.equal(can(role, `write:${action}`), roles.includes(role), action)
      assert.equal(canWrite(role, action), roles.includes(role), action)
    }
    assert.equal(
      can(role, 'settings:catalogue'),
      workspaceRoles.settings.includes(role)
    )
    assert.equal(can(role, 'admin:users'), role === 'admin_owner')
  }
  assert.equal(can(null, 'route:operations'), false)
  assert.equal(can('admin_owner', 'write:unknown'), false)
  assert.equal(can(' Admin Owner ', 'write:prices'), true)
})

test('every route a role can see is backed by an authorized server read', () => {
  for (const role of server.ALL_ROLES)
    for (const destination of routesForRole(role)) {
      if (destination.workspace)
        assert.ok(
          workspaceRoles[destination.workspace].includes(role),
          `${role} sees ${destination.path} but cannot read ${destination.workspace}`
        )
      else assert.equal(destination.name, 'admin') // reads api/users.ts
    }
  assert.ok(
    routesForRole('read_only_management').every(d => d.name !== 'admin')
  )
})

test('settings roles can read every projection catalogue settings renders', () => {
  // Data inside a workspace is filtered per projection by `access`; the
  // settings page in particular needs every projection it renders.
  for (const key of ['variants', 'materials', 'recipes', 'pricing'])
    for (const role of workspaceRoles.settings)
      assert.ok(access[key].includes(role), `${role} settings ${key}`)
  assert.equal(Object.keys(access).length >= 18, true)
})

test('route hidden although the workspace is readable only where documented', () => {
  const found = []
  for (const role of server.ALL_ROLES)
    for (const destination of DESTINATIONS)
      if (
        destination.workspace &&
        workspaceRoles[destination.workspace].includes(role) &&
        !can(role, `route:${destination.name}`)
      )
        found.push(`${role}:${destination.name}`)
  same(found, EXPECTED_ASYMMETRIES)
  same(
    ROUTE_ASYMMETRIES.map(({ role, route }) => `${role}:${route}`),
    EXPECTED_ASYMMETRIES
  )
})

test('every role that may write an action can reach the page that hosts it', () => {
  same(Object.keys(WRITE_HOME), Object.keys(server.WRITE_ROLES))
  for (const [action, roles] of Object.entries(server.WRITE_ROLES))
    for (const role of roles)
      assert.ok(
        can(role, `route:${WRITE_HOME[action]}`),
        `${role} may write ${action} but cannot open /${WRITE_HOME[action]}`
      )
})

test('route visibility: home for every working role, existing routes preserved', () => {
  const visible = Object.fromEntries(
    server.ALL_ROLES.map(role => [role, routesForRole(role).map(d => d.name)])
  )
  assert.deepEqual(visible, {
    admin_owner: [
      'home',
      'dashboard',
      'operations',
      'retail',
      'finance',
      'settings',
      'admin'
    ],
    operations_manager: [
      'home',
      'dashboard',
      'operations',
      'retail',
      'finance',
      'settings'
    ],
    production_staff: ['home', 'dashboard', 'operations'],
    warehouse_staff: ['home', 'dashboard', 'operations', 'retail'],
    sales_or_distribution_staff: ['home', 'dashboard', 'retail'],
    finance_accountant: ['home', 'dashboard', 'retail', 'finance'],
    read_only_management: ['dashboard', 'finance']
  })
  // A signed-in user still awaiting a role keeps the dashboard only.
  assert.deepEqual(
    routesForRole(null).map(d => d.name),
    ['dashboard']
  )
})

test('router meta.roles derive from the capability matrix', () => {
  const children = routes.find(route => route.path === '/').children
  for (const destination of DESTINATIONS) {
    const route = children.find(child => child.name === destination.name)
    assert.ok(route, `route ${destination.name} missing`)
    assert.equal(`/${route.path}`, destination.path)
    if (destination.anyAuthenticated)
      assert.equal(route.meta.allowedRoles, undefined)
    else assert.equal(route.meta.allowedRoles, destination.roles)
  }
})

test('bottom navigation: at most four items, More when needed, hidden for one', () => {
  for (const role of server.ALL_ROLES) {
    const items = primaryDestinations(role)
    assert.ok(items.length <= MAX_BOTTOM_NAV_ITEMS, role)
    assert.ok(items.length !== 1, role)
    const routeNames = routesForRole(role).map(d => d.name)
    for (const item of items)
      assert.ok(item.more || routeNames.includes(item.name), role)
  }
  assert.deepEqual(
    primaryDestinations('admin_owner').map(d => d.name),
    ['home', 'dashboard', 'operations', 'more']
  )
  const five = [1, 2, 3, 4, 5].map(n => ({ name: `d${n}` }))
  assert.deepEqual(
    bottomNavItems(five).map(d => d.name),
    ['d1', 'd2', 'd3', 'more']
  )
  assert.deepEqual(bottomNavItems(five.slice(0, 1)), [])
  assert.equal(bottomNavItems(five.slice(0, 4)).length, 4)
})

test('landing routes are visible to their role', () => {
  for (const role of server.ALL_ROLES) {
    const landing = defaultRouteForRole(role)
    assert.equal(landing, LANDING_ROUTES[role])
    assert.equal(getDefaultRouteForRole(role), landing)
    assert.ok(
      routesForRole(role).some(d => d.path === landing),
      role
    )
  }
  assert.equal(defaultRouteForRole(null), '/')
})
