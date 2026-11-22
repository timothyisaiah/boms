// Route registry for browser specs. Role access is read from the real router
// table so the tests can never drift from `src/router/routes.js`.
import appRoutes from '../../../src/router/routes.js'
import { ROLES } from './fixtures.js'

const main = appRoutes.find(route => route.path === '/')
const allowedRolesFor = name =>
  main.children.find(child => child.name === name)?.meta?.allowedRoles ?? ROLES

/**
 * name:      used for screenshot/test names
 * path:      hash path passed to gotoRoute
 * heading:   accessible name of the destination's single h1 (string = exact)
 * ready:     optional fallback text for a route without a configured h1
 * workspace: `/api/workspace?name=` the route loads on entry (or null)
 * roles:     roles that can open the route; `null` = signed-out only
 */
export const ROUTES = {
  auth: {
    name: 'auth',
    path: '/auth',
    heading: /^From hive to handoff/,
    workspace: null,
    roles: null
  },
  home: {
    name: 'home',
    path: '/home',
    heading: 'Home',
    workspace: 'home',
    roles: allowedRolesFor('home')
  },
  dashboard: {
    name: 'dashboard',
    path: '/',
    heading: 'Beecone dashboard',
    workspace: 'dashboard',
    roles: allowedRolesFor('dashboard')
  },
  operations: {
    name: 'operations',
    path: '/operations',
    heading: 'Supply and production',
    workspace: 'operations',
    roles: allowedRolesFor('operations')
  },
  retail: {
    name: 'retail',
    path: '/retail',
    heading: 'Warehouse and retail stock',
    workspace: 'retail',
    roles: allowedRolesFor('retail')
  },
  finance: {
    name: 'finance',
    path: '/finance',
    heading: 'Reconciliation and cash',
    workspace: 'finance',
    roles: allowedRolesFor('finance')
  },
  admin: {
    name: 'admin',
    path: '/admin',
    heading: 'Users & access',
    workspace: null,
    roles: allowedRolesFor('admin')
  },
  settings: {
    name: 'settings',
    path: '/settings',
    heading: 'Catalogue settings',
    workspace: 'settings',
    roles: allowedRolesFor('settings')
  },
  accessDenied: {
    name: 'access-denied',
    path: '/access-denied',
    heading: 'Access restricted',
    workspace: null,
    roles: ROLES
  },
  notFound: {
    name: 'not-found',
    path: '/not-a-real-route',
    heading: 'Page not found',
    workspace: null,
    roles: ROLES
  }
}

export const ALL_ROUTES = Object.values(ROUTES)

/** Routes rendered inside MainLayout that require a signed-in user. */
export const APP_ROUTES = [
  ROUTES.home,
  ROUTES.dashboard,
  ROUTES.operations,
  ROUTES.retail,
  ROUTES.finance,
  ROUTES.admin,
  ROUTES.accessDenied
]

export const canReach = (route, role) =>
  route.roles === null ? !role : Boolean(role) && route.roles.includes(role)

/** gotoRoute options for a registry entry. */
export const routeTarget = route => ({
  heading: route.heading,
  ready: route.ready,
  workspace: route.workspace
})
