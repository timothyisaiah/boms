<template>
  <section class="user-management" aria-labelledby="staff-accounts-title">
    <div class="user-management__header">
      <h2 id="staff-accounts-title" class="section-title q-my-none"
        >Staff accounts</h2
      >
      <q-btn
        v-if="!hideTrigger"
        color="primary"
        icon="person_add"
        label="Add user"
        no-caps
        unelevated
        @click="openCreate"
      />
    </div>
    <p class="user-management__intro"
      >Create staff accounts, assign roles, and deactivate access when someone
      leaves.</p
    >
    <q-banner
      v-if="notice"
      rounded
      class="user-banner user-banner--success q-mb-md"
      role="status"
      >{{ notice }}</q-banner
    >
    <q-banner
      v-if="listError"
      rounded
      class="user-banner user-banner--danger q-mb-md"
      role="alert"
    >
      {{ listError }}
      <template #action
        ><q-btn flat label="Retry loading users" no-caps @click="loadUsers"
      /></template>
    </q-banner>
    <q-input
      v-model="search"
      outlined
      label="Search users by name or email"
      clearable
      class="q-mb-md"
    />
    <q-linear-progress
      v-if="loading"
      indeterminate
      class="q-mb-md"
      aria-label="Loading users"
    />
    <div class="user-grid">
      <article v-for="user in filteredUsers" :key="user.id" class="user-card">
        <h3 class="user-name"
          >{{ user.full_name || 'Unnamed user' }}
          <span v-if="user.id === authState.user?.id">(you)</span></h3
        >
        <div class="user-email">{{ user.email }}</div>
        <div class="q-my-sm">{{ getRoleLabel(user.role) }}</div>
        <div class="row items-center justify-between">
          <span
            class="status-chip"
            :class="
              user.is_active ? 'status-chip--success' : 'status-chip--neutral'
            "
            >{{ user.is_active ? 'Active' : 'Inactive' }}</span
          >
          <q-btn
            flat
            color="primary"
            label="Edit access"
            no-caps
            :aria-label="`Edit access for ${user.full_name || user.email}`"
            @click="openEdit(user)"
          />
        </div>
      </article>
    </div>
    <p v-if="!loading && !listError && !filteredUsers.length" class="q-mt-md"
      >No users match this search.</p
    >
  </section>
  <q-dialog
    v-model="editorOpen"
    persistent
    :maximized="$q.screen.lt.sm"
    aria-labelledby="user-editor-title"
  >
    <q-card class="user-editor">
      <q-card-section class="user-editor__header">
        <h2 id="user-editor-title" class="user-editor__title">{{
          form.id ? 'Edit user access' : 'Add user'
        }}</h2>
        <q-btn
          flat
          round
          icon="close"
          aria-label="Close user editor"
          :disable="saving"
          @click="closeEditor"
        />
      </q-card-section>
      <q-form
        ref="formRef"
        greedy
        no-error-focus
        @submit.prevent="saveUser"
        @validation-error="onInvalid"
      >
        <q-card-section class="q-gutter-md">
          <FormErrorSummary ref="summaryRef" :errors="formErrors" />
          <q-banner
            v-if="saveError"
            rounded
            class="user-banner user-banner--danger"
            role="alert"
            >{{ saveError }}</q-banner
          >
          <q-input
            v-model="form.fullName"
            outlined
            for="user-full-name"
            label="Full name"
            autocomplete="off"
            :rules="[required]"
            :disable="saving"
            maxlength="120"
          />
          <q-input
            v-model="form.email"
            outlined
            for="user-email"
            label="Email address"
            type="email"
            autocomplete="off"
            :rules="[required, emailRule]"
            :readonly="!!form.id"
            :disable="saving"
            maxlength="254"
            :hint="
              form.id
                ? 'Sign-in email'
                : 'The user will sign in with this email.'
            "
          />
          <q-select
            v-model="form.role"
            outlined
            for="user-role"
            label="User role"
            :options="ROLE_OPTIONS"
            emit-value
            map-options
            :rules="[required]"
            :disable="saving || editingSelf"
            :behavior="selectBehavior"
          />
          <q-toggle
            v-model="form.isActive"
            label="Account active"
            :disable="saving || editingSelf"
            class="user-active-toggle"
          />
          <p v-if="editingSelf" class="text-caption"
            >Another administrator must change your own role or active
            status.</p
          >
          <q-input
            v-model="form.password"
            outlined
            for="user-password"
            :label="form.id ? 'New password (optional)' : 'Initial password'"
            type="password"
            autocomplete="new-password"
            :rules="[passwordRule]"
            :disable="saving"
            :hint="
              form.id
                ? 'Leave blank to keep the password. Setting a new password signs this user out.'
                : 'Use at least 12 characters. Share this password with the user securely.'
            "
          />
          <p v-if="form.id && !form.isActive" class="text-caption"
            >Saving will sign this user out and prevent further sign-in.</p
          >
        </q-card-section>
        <q-card-actions align="right" class="q-pa-md">
          <q-btn
            flat
            no-caps
            label="Cancel"
            :disable="saving"
            @click="closeEditor"
          />
          <q-btn
            color="primary"
            no-caps
            :label="form.id ? 'Save access' : 'Create user'"
            type="submit"
            :loading="saving"
            :disable="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { apiRequest } from '@/lib/api'
import { required } from '@/lib/validation'
import { ROLE_OPTIONS, getRoleLabel } from '@/constants/roles'
import { authState, signOut } from '@/services/auth'
import { collectFieldErrors, useFormErrors } from '@/composables/useFormErrors'
import FormErrorSummary from './FormErrorSummary.vue'

defineProps({
  /** Hide the built-in "Add user" button (the page header owns it). */
  hideTrigger: Boolean
})

const $q = useQuasar()
const router = useRouter()
// MF-17: touch-friendly dialog pickers on phones, keyboard menus elsewhere.
const selectBehavior = computed(() => ($q.screen.lt.sm ? 'dialog' : 'menu'))
const formRef = ref(null)
const {
  errors: formErrors,
  summaryRef,
  fail,
  clear: clearErrors
} = useFormErrors()
const users = ref([]),
  search = ref(''),
  loading = ref(false),
  listError = ref('')
const editorOpen = ref(false),
  saving = ref(false),
  saveError = ref(''),
  notice = ref('')
const form = reactive({
  id: null,
  fullName: '',
  email: '',
  role: 'read_only_management',
  isActive: true,
  password: ''
})
const editingSelf = computed(() => form.id === authState.user?.id)
const filteredUsers = computed(() => {
  const term = (search.value || '').trim().toLowerCase()
  return users.value.filter(user =>
    `${user.full_name} ${user.email}`.toLowerCase().includes(term)
  )
})
const emailRule = value =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ||
  'Enter a valid email address.'
const passwordRule = value =>
  (form.id && !value) ||
  (value.length >= 12 && new TextEncoder().encode(value).length <= 72) ||
  'Use at least 12 characters and at most 72 bytes.'
async function onInvalid() {
  await nextTick()
  await fail(collectFieldErrors(formRef))
}
async function loadUsers() {
  loading.value = true
  listError.value = ''
  try {
    users.value = (await apiRequest('users')).users
  } catch (error) {
    listError.value = error.message
  } finally {
    loading.value = false
  }
}
function openCreate() {
  Object.assign(form, {
    id: null,
    fullName: '',
    email: '',
    role: 'read_only_management',
    isActive: true,
    password: ''
  })
  saveError.value = ''
  clearErrors()
  editorOpen.value = true
}
function openEdit(user) {
  Object.assign(form, {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    password: ''
  })
  saveError.value = ''
  clearErrors()
  editorOpen.value = true
}
function closeEditor() {
  form.password = ''
  clearErrors()
  editorOpen.value = false
}
async function saveUser() {
  if (saving.value) return
  saving.value = true
  saveError.value = ''
  notice.value = ''
  clearErrors()
  const resetsOwnPassword = editingSelf.value && !!form.password
  const body = {
    fullName: form.fullName.trim(),
    role: form.role,
    isActive: form.isActive
  }
  if (form.id) body.id = form.id
  else body.email = form.email.trim().toLowerCase()
  if (form.password) body.password = form.password
  try {
    await apiRequest('users', {
      method: form.id ? 'PATCH' : 'POST',
      body: JSON.stringify(body)
    })
    notice.value = form.id
      ? 'User access saved.'
      : 'User created. They can sign in with the assigned credentials.'
    closeEditor()
    if (resetsOwnPassword) {
      await signOut()
      await router.replace('/auth')
      return
    }
    await loadUsers()
  } catch (error) {
    saveError.value =
      error.kind === 'network'
        ? 'The result could not be confirmed. Close this form and refresh the user list before trying again.'
        : error.message
  } finally {
    form.password = ''
    saving.value = false
  }
}
onMounted(loadUsers)

defineExpose({ openCreate })
</script>

<style scoped>
.user-management__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-2);
}
.user-management__intro {
  margin: var(--boms-space-2) 0 var(--boms-space-4);
  color: var(--boms-color-text-muted);
}
.user-banner--success {
  background: var(--boms-color-success-bg);
  color: var(--boms-color-success-text);
}
.user-banner--danger {
  background: var(--boms-color-danger-bg);
  color: var(--boms-color-danger-text);
}
.user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: var(--boms-space-3);
}
.user-card {
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface);
  padding: var(--boms-space-3) var(--boms-space-4);
  min-width: 0;
}
.user-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: normal;
  overflow-wrap: anywhere;
}
.user-email {
  overflow-wrap: anywhere;
}
.user-editor {
  width: 600px;
  max-width: 100%;
}
.user-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-2);
}
.user-editor__title {
  margin: 0;
  color: var(--boms-color-heading);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: normal;
}
.user-active-toggle {
  min-height: 44px;
}
</style>
