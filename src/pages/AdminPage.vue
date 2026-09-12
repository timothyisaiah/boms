<template>
  <q-page class="page-layout">
    <section class="page-hero">
      <div>
        <p class="page-hero__eyebrow">Admin</p>
        <h1 class="page-hero__title">Access and settings</h1>
        <p class="page-hero__body">
          Add staff accounts, manage access, and configure your catalogue.
        </p>
      </div>
    </section>

    <UserManagement />
    <section class="card-grid card-grid--two">
      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Environment</div>
          <div class="section-title">Session status</div>
        </q-card-section>

        <q-card-section class="detail-list">
          <div class="detail-row">
            <span>Authenticated session</span>
            <q-chip
              square
              :color="authState.session ? 'positive' : 'negative'"
              text-color="white"
            >
              {{ authState.session ? 'Active' : 'Missing' }}
            </q-chip>
          </div>

          <div class="detail-row">
            <span>Authenticated email</span>
            <span>{{ authState.user?.email ?? 'No active session' }}</span>
          </div>

          <div class="detail-row">
            <span>User account loaded</span>
            <q-chip
              square
              :color="authState.profile ? 'positive' : 'warning'"
              text-color="white"
            >
              {{ authState.profile ? 'Yes' : 'Not yet' }}
            </q-chip>
          </div>

          <div class="detail-row">
            <span>Resolved role</span>
            <span>{{ roleLabel }}</span>
          </div>

          <div class="detail-row">
            <span>Profile active</span>
            <span>{{
              authState.profile?.is_active === false ? 'No' : 'Yes'
            }}</span>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Role matrix</div>
          <div class="section-title">Current BOMS roles</div>
        </q-card-section>

        <q-list separator class="surface-list">
          <q-item v-for="role in roles" :key="role.value">
            <q-item-section>
              <q-item-label>{{ role.label }}</q-item-label>
              <q-item-label caption>{{ role.value }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </section>
    <CatalogueSettings />
  </q-page>
</template>

<script setup>
import CatalogueSettings from '@/components/CatalogueSettings.vue'
import UserManagement from '@/components/UserManagement.vue'
import { computed } from 'vue'
import { ROLE_OPTIONS, getRoleLabel } from '@/constants/roles'
import { authState } from '@/services/auth'

const roles = ROLE_OPTIONS
const roleLabel = computed(() => getRoleLabel(authState.role))
</script>
