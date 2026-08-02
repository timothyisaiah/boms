<template>
  <q-page class="page-layout">
    <section class="page-hero">
      <div>
        <p class="page-hero__eyebrow">Foundation plus phase 2</p>
        <h1 class="page-hero__title"
          >BOMS now covers secure access and the first real supply workflow.</h1
        >
        <p class="page-hero__body">
          The Beecone app now combines Supabase-backed authentication with
          seeded catalogue masters, purchase receipt entry, material lot
          tracking, and production batch costing so the MVP can move from shell
          screens into transactional truth.
        </p>
      </div>

      <div class="page-hero__actions">
        <q-btn
          color="primary"
          no-caps
          label="Open operations"
          to="/operations"
        />
        <q-btn
          flat
          color="secondary"
          no-caps
          label="Review finance route"
          to="/finance"
        />
      </div>
    </section>

    <section class="card-grid card-grid--three">
      <q-card
        v-for="metric in metrics"
        :key="metric.title"
        flat
        class="surface-card metric-card"
      >
        <q-card-section>
          <div class="section-label">{{ metric.label }}</div>
          <div class="section-title">{{ metric.title }}</div>
          <p class="text-body2 text-grey-8 q-mt-sm">{{ metric.text }}</p>
        </q-card-section>
      </q-card>
    </section>

    <section class="card-grid card-grid--two">
      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Session summary</div>
          <div class="section-title">Current authenticated context</div>
        </q-card-section>

        <q-card-section class="detail-list">
          <div class="detail-row">
            <span>Signed in user</span>
            <span>{{ authState.user?.email ?? 'No active session' }}</span>
          </div>

          <div class="detail-row">
            <span>Resolved role</span>
            <span>{{ roleLabel }}</span>
          </div>

          <div class="detail-row">
            <span>Supabase configured</span>
            <q-chip
              square
              :color="isSupabaseConfigured ? 'positive' : 'warning'"
              text-color="white"
            >
              {{ isSupabaseConfigured ? 'Yes' : 'Not yet' }}
            </q-chip>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Role-aware workspaces</div>
          <div class="section-title">What this foundation unlocked</div>
        </q-card-section>

        <q-list separator class="surface-list">
          <q-item v-for="workspace in workspaces" :key="workspace.title">
            <q-item-section avatar>
              <q-icon :name="workspace.icon" color="primary" />
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ workspace.title }}</q-item-label>
              <q-item-label caption>{{ workspace.text }}</q-item-label>
            </q-item-section>

            <q-item-section side>
              <q-btn
                flat
                color="secondary"
                no-caps
                :to="workspace.to"
                label="Open"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </section>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { getRoleLabel, hasAllowedRole } from '@/constants/roles'
import { authState, isSupabaseConfigured } from '@/services/auth'

const metrics = [
  {
    label: 'Security',
    title: 'Protected navigation',
    text: 'Unauthenticated users are redirected to sign in before any workspace loads.'
  },
  {
    label: 'Supply',
    title: 'Receipts become inventory lots',
    text: 'Phase 2 now records honey and packaging purchases as auditable material lots ready for production consumption.'
  },
  {
    label: 'Production',
    title: 'Batch costing is centralized',
    text: 'Production batches now consume real lots and calculate repeatable cost per jar in the database layer.'
  }
]

const allWorkspaces = [
  {
    title: 'Operations workspace',
    text: 'Purchasing, material lots, production batches, and output costing.',
    to: '/operations',
    icon: 'warehouse',
    allowedRoles: [
      'admin_owner',
      'operations_manager',
      'production_staff',
      'warehouse_staff'
    ]
  },
  {
    title: 'Retail workspace',
    text: 'Distribution, reconciliation, and retailer movement.',
    to: '/retail',
    icon: 'storefront',
    allowedRoles: [
      'admin_owner',
      'operations_manager',
      'sales_or_distribution_staff',
      'finance_accountant'
    ]
  },
  {
    title: 'Finance workspace',
    text: 'Remittances, margins, and management review.',
    to: '/finance',
    icon: 'payments',
    allowedRoles: ['admin_owner', 'finance_accountant', 'read_only_management']
  },
  {
    title: 'Access and settings',
    text: 'Admin-only environment and role audit.',
    to: '/admin',
    icon: 'manage_accounts',
    allowedRoles: ['admin_owner']
  }
]

const workspaces = computed(() =>
  allWorkspaces.filter(workspace =>
    hasAllowedRole(authState.role, workspace.allowedRoles)
  )
)
const roleLabel = computed(() => getRoleLabel(authState.role))
</script>
