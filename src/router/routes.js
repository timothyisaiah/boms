import { DESTINATIONS } from '../constants/capabilities.js'

const pages = {
  dashboard: () => import('@/pages/IndexPage.vue'),
  operations: () => import('@/pages/OperationsPage.vue'),
  retail: () => import('@/pages/RetailPage.vue'),
  finance: () => import('@/pages/FinancePage.vue'),
  settings: () => import('@/pages/SettingsPage.vue'),
  admin: () => import('@/pages/AdminPage.vue')
}

const routes = [
  {
    path: '/auth',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: {
      guestOnly: true,
      title: 'Sign in'
    },
    children: [
      {
        path: '',
        name: 'auth',
        component: () => import('@/pages/AuthPage.vue')
      }
    ]
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: {
      requiresAuth: true
    },
    children: [
      ...DESTINATIONS.map(destination => ({
        path: destination.path.slice(1),
        name: destination.name,
        component: pages[destination.name],
        meta: {
          title: destination.title,
          // Derived from the capability matrix; the guard in index.js enforces it.
          ...(destination.anyAuthenticated
            ? {}
            : { allowedRoles: destination.roles })
        }
      })),
      {
        path: 'access-denied',
        name: 'access-denied',
        component: () => import('@/pages/UnauthorizedPage.vue'),
        meta: {
          title: 'Access restricted'
        }
      }
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/ErrorNotFound.vue')
  }
]

export default routes
