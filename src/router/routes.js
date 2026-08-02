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
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/pages/IndexPage.vue'),
        meta: {
          title: 'Operations dashboard'
        }
      },
      {
        path: 'operations',
        name: 'operations',
        component: () => import('@/pages/OperationsPage.vue'),
        meta: {
          title: 'Supply and production control tower',
          allowedRoles: [
            'admin_owner',
            'operations_manager',
            'production_staff',
            'warehouse_staff'
          ]
        }
      },
      {
        path: 'retail',
        name: 'retail',
        component: () => import('@/pages/RetailPage.vue'),
        meta: {
          title: 'Retail workspace',
          allowedRoles: [
            'admin_owner',
            'operations_manager',
            'sales_or_distribution_staff',
            'finance_accountant'
          ]
        }
      },
      {
        path: 'finance',
        name: 'finance',
        component: () => import('@/pages/FinancePage.vue'),
        meta: {
          title: 'Finance workspace',
          allowedRoles: [
            'admin_owner',
            'finance_accountant',
            'read_only_management'
          ]
        }
      },
      {
        path: 'admin',
        name: 'admin',
        component: () => import('@/pages/AdminPage.vue'),
        meta: {
          title: 'Access and settings',
          allowedRoles: ['admin_owner']
        }
      },
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
