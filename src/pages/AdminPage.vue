<template>
  <q-page class="page-layout">
    <PageHeader
      title="Users & access"
      subtitle="Add staff accounts, assign roles and remove access."
      :actions="[
        {
          label: 'Catalogue settings',
          icon: 'tune',
          to: '/settings'
        }
      ]"
    >
      <template #primary>
        <q-btn
          color="primary"
          icon="person_add"
          label="Add user"
          no-caps
          unelevated
          @click="userManagement?.openCreate()"
        />
      </template>
    </PageHeader>

    <UserManagement ref="userManagement" hide-trigger />

    <!--
      MF-13 / roadmap iteration 6: technical session and role diagnostics are
      kept for support but collapsed out of the primary task.
    -->
    <q-expansion-item
      class="session-details"
      icon="info"
      label="Session details"
      caption="Sign-in status and role reference for troubleshooting"
      header-class="session-details__header"
    >
      <div class="session-details__body">
        <dl class="session-details__list">
          <div>
            <dt>Session</dt>
            <dd>{{ authState.session ? 'Active' : 'Missing' }}</dd>
          </div>
          <div>
            <dt>Signed in as</dt>
            <dd>{{ authState.user?.email ?? 'No active session' }}</dd>
          </div>
          <div>
            <dt>Account loaded</dt>
            <dd>{{ authState.profile ? 'Yes' : 'Not yet' }}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{{ roleLabel }}</dd>
          </div>
          <div>
            <dt>Account active</dt>
            <dd>{{ authState.profile?.is_active === false ? 'No' : 'Yes' }}</dd>
          </div>
        </dl>
        <p class="session-details__caption">BOMS roles</p>
        <ul class="session-details__roles">
          <li v-for="role in roles" :key="role.value">
            {{ role.label }} <code>{{ role.value }}</code>
          </li>
        </ul>
      </div>
    </q-expansion-item>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import UserManagement from '@/components/UserManagement.vue'
import { ROLE_OPTIONS, getRoleLabel } from '@/constants/roles'
import { authState } from '@/services/auth'

const userManagement = ref(null)
const roles = ROLE_OPTIONS
const roleLabel = computed(() => getRoleLabel(authState.role))
</script>

<style scoped>
.session-details {
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  overflow: hidden;
}
.session-details__body {
  padding: var(--boms-space-2) var(--boms-space-4) var(--boms-space-4);
}
.session-details__list {
  display: grid;
  gap: var(--boms-space-2);
  margin: 0;
}
.session-details__list > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--boms-space-1) var(--boms-space-4);
}
.session-details__list dt {
  color: var(--boms-color-text-muted);
}
.session-details__list dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.session-details__caption {
  margin: var(--boms-space-4) 0 var(--boms-space-1);
  font-weight: 700;
}
.session-details__roles {
  margin: 0;
  padding-left: 1.25rem;
}
.session-details__roles code {
  color: var(--boms-color-text-muted);
}
</style>
