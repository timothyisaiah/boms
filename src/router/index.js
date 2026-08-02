import { defineRouter } from '#q-app'
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory
} from 'vue-router'

import { hasAllowedRole } from '@/constants/roles'
import {
  authState,
  getDefaultRouteForRole,
  initializeAuth,
  resolveSafeRedirect
} from '@/services/auth'
import routes from './routes.js'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter((/* { store, ssrContext } */) => {
  const createHistory = import.meta.env.QUASAR_SERVER
    ? createMemoryHistory
    : import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE)
  })

  Router.beforeEach(async to => {
    await initializeAuth()

    const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
    const guestOnly = to.matched.some(record => record.meta.guestOnly)
    const allowedRoles = to.matched.flatMap(record =>
      Array.isArray(record.meta.allowedRoles) ? record.meta.allowedRoles : []
    )
    const isAuthenticated = Boolean(authState.user)

    if (guestOnly && isAuthenticated) {
      return resolveSafeRedirect(
        typeof to.query.next === 'string' ? to.query.next : null,
        getDefaultRouteForRole(authState.role)
      )
    }

    if (requiresAuth && !isAuthenticated) {
      return {
        name: 'auth',
        query: {
          next: to.fullPath
        }
      }
    }

    if (
      requiresAuth &&
      allowedRoles.length > 0 &&
      !hasAllowedRole(authState.role, allowedRoles)
    ) {
      if (to.name === 'access-denied') {
        return true
      }

      return {
        name: 'access-denied',
        query: {
          from: to.fullPath
        }
      }
    }

    return true
  })

  Router.afterEach(to => {
    const pageTitle = to.meta.title ?? 'BOMS'

    document.title = `${pageTitle} | Beecone Operations Management System`
  })

  return Router
})
