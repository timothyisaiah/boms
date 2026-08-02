<template>
  <q-layout view="hHh Lpr lFf" class="shell-layout">
    <q-header class="shell-header">
      <q-toolbar class="q-px-md q-py-sm q-px-lg-md">
        <q-btn
          flat
          dense
          round
          icon="menu"
          color="brown-10"
          aria-label="Toggle navigation"
          @click="toggleLeftDrawer"
        />

        <div class="brand-lockup">
          <div class="brand-badge">B</div>
          <div>
            <div class="brand-kicker">Beecone Honey</div>
            <div class="brand-title">Operations Management System</div>
          </div>
        </div>

        <div class="route-context gt-sm">
          <div class="route-context__eyebrow">Traceability first</div>
          <div class="route-context__title">{{ pageTitle }}</div>
        </div>

        <q-space />

        <div class="topbar-user">
          <q-chip
            square
            color="amber-2"
            text-color="brown-10"
            icon="verified_user"
          >
            {{ roleLabel }}
          </q-chip>

          <div class="topbar-user__meta gt-xs">
            <div class="topbar-user__name">{{ userName }}</div>
            <div class="topbar-user__email">{{ authState.user?.email }}</div>
          </div>

          <q-btn
            flat
            color="primary"
            no-caps
            :loading="isSigningOut"
            label="Sign out"
            @click="handleSignOut"
          />
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      :width="280"
      class="shell-drawer"
    >
      <div class="drawer-summary">
        <div class="drawer-summary__label">Signed in as</div>
        <div class="drawer-summary__name">{{ userName }}</div>
        <div class="drawer-summary__email">{{ authState.user?.email }}</div>
      </div>

      <q-list padding class="drawer-nav">
        <q-item-label header class="drawer-nav__header">
          Workspaces
        </q-item-label>

        <q-item
          v-for="item in navigationItems"
          :key="item.to"
          clickable
          :to="item.to"
          class="drawer-link"
          active-class="drawer-link--active"
        >
          <q-item-section avatar>
            <q-icon :name="item.icon" />
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ item.label }}</q-item-label>
            <q-item-label caption>{{ item.caption }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <div class="drawer-footer q-pa-md">
        <q-banner
          v-if="!isSupabaseConfigured"
          class="bg-orange-1 text-dark rounded-borders"
        >
          Supabase env vars are missing. Add
          <code>VITE_SUPABASE_URL</code> and
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to enable live
          authentication.
        </q-banner>

        <q-banner
          v-else-if="!authState.role"
          class="bg-amber-1 text-dark rounded-borders"
        >
          This account is authenticated, but it still needs a BOMS role
          assignment before restricted routes unlock.
        </q-banner>
      </div>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getRoleLabel, hasAllowedRole } from '@/constants/roles'
import { authState, isSupabaseConfigured, signOut } from '@/services/auth'

const leftDrawerOpen = ref(false)
const isSigningOut = ref(false)
const route = useRoute()
const router = useRouter()

const allNavigationItems = [
  {
    label: 'Dashboard',
    caption: 'Foundation status and quick links',
    icon: 'space_dashboard',
    to: '/'
  },
  {
    label: 'Operations',
    caption: 'Supply, production, and warehouse flows',
    icon: 'warehouse',
    to: '/operations',
    allowedRoles: [
      'admin_owner',
      'operations_manager',
      'production_staff',
      'warehouse_staff'
    ]
  },
  {
    label: 'Distribution',
    caption: 'Warehouse stock, issues, and retailer movement',
    icon: 'storefront',
    to: '/retail',
    allowedRoles: [
      'admin_owner',
      'operations_manager',
      'warehouse_staff',
      'sales_or_distribution_staff',
      'finance_accountant'
    ]
  },
  {
    label: 'Finance',
    caption: 'Remittances, margins, and review',
    icon: 'payments',
    to: '/finance',
    allowedRoles: ['admin_owner', 'finance_accountant', 'read_only_management']
  },
  {
    label: 'Access & Settings',
    caption: 'Environment and role model',
    icon: 'manage_accounts',
    to: '/admin',
    allowedRoles: ['admin_owner']
  }
]

const navigationItems = computed(() =>
  allNavigationItems.filter(item =>
    hasAllowedRole(authState.role, item.allowedRoles)
  )
)
const pageTitle = computed(() => route.meta.title ?? 'Operations dashboard')
const userName = computed(() => {
  const fullName =
    authState.profile?.full_name?.trim() ??
    authState.user?.user_metadata?.full_name?.trim()

  if (fullName) {
    return fullName
  }

  return authState.user?.email?.split('@')[0] ?? 'Beecone teammate'
})
const roleLabel = computed(() => getRoleLabel(authState.role))

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

async function handleSignOut() {
  isSigningOut.value = true

  try {
    await signOut()
    await router.replace('/auth')
  } finally {
    isSigningOut.value = false
  }
}
</script>
