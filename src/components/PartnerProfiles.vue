<template>
  <q-btn
    v-if="allowed && !hideTrigger"
    flat
    color="secondary"
    no-caps
    icon="manage_search"
    :label="`Manage ${kind}s`"
    @click="openManager"
  />

  <q-dialog
    v-model="dialogOpen"
    persistent
    :maximized="$q.screen.lt.sm"
    :aria-labelledby="`${kind}-profiles-title`"
  >
    <q-card class="partner-manager">
      <q-card-section class="manager-header">
        <h2 :id="`${kind}-profiles-title`" class="manager-title">
          {{ editing ? `Edit ${kind}` : `Manage ${kind}s` }}
        </h2>
        <q-btn
          flat
          round
          icon="close"
          :aria-label="`Close ${kind} profiles`"
          :disable="saving"
          @click="hide"
        />
      </q-card-section>

      <template v-if="!editing">
        <q-card-section class="q-pt-none">
          <p>
            Search active and inactive {{ kind }} profiles, then open one to
            update its details or status.
          </p>
          <q-banner
            v-if="notice"
            rounded
            class="manager-banner manager-banner--success q-mb-md"
            role="status"
          >
            {{ notice }}
          </q-banner>
          <q-banner
            v-if="loadError"
            rounded
            class="manager-banner manager-banner--danger q-mb-md"
            role="alert"
          >
            {{ loadError }}
            <template #action>
              <q-btn flat no-caps label="Retry" @click="loadPartners" />
            </template>
          </q-banner>
          <div class="partner-filters q-mb-md">
            <q-input
              v-model="search"
              outlined
              clearable
              :label="`Search ${kind}s`"
              :placeholder="`Name, contact, phone, email${kind === 'retailer' ? ' or location' : ''}`"
            />
            <q-select
              v-model="statusFilter"
              outlined
              label="Status"
              :options="statusOptions"
              emit-value
              map-options
              :behavior="selectBehavior"
            />
          </div>
          <q-linear-progress
            v-if="loading"
            indeterminate
            aria-label="Loading profiles"
          />
          <div v-else class="partner-list">
            <article
              v-for="partner in filteredPartners"
              :key="partner.id"
              class="partner-profile-card"
            >
              <div class="row items-start justify-between q-gutter-sm">
                <div class="partner-card-copy">
                  <h3 class="partner-name">{{ partner.name }}</h3>
                  <div class="text-caption">
                    {{
                      kind === 'supplier'
                        ? supplierKindLabel(partner.supplier_kind)
                        : partner.delivery_location || 'No delivery location'
                    }}
                  </div>
                </div>
                <span
                  class="status-chip"
                  :class="
                    partner.is_active
                      ? 'status-chip--success'
                      : 'status-chip--neutral'
                  "
                >
                  {{ partner.is_active ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <div class="profile-details q-mt-sm">
                <span>{{ partner.contact_name || 'No contact person' }}</span>
                <span>{{ partner.phone || 'No phone' }}</span>
                <span>{{ partner.email || 'No email' }}</span>
              </div>
              <q-btn
                flat
                color="primary"
                no-caps
                class="q-mt-sm"
                label="View and edit profile"
                :aria-label="`View and edit ${partner.name}`"
                @click="editPartner(partner)"
              />
            </article>
          </div>
          <p v-if="!loading && !filteredPartners.length" class="q-mt-md">
            No {{ kind }} profiles match this search and status.
          </p>
        </q-card-section>
      </template>

      <q-form
        v-else
        ref="formRef"
        greedy
        no-error-focus
        @submit.prevent="saveProfile"
        @validation-error="onInvalid"
      >
        <q-card-section class="q-gutter-md q-pt-none">
          <q-btn
            flat
            no-caps
            icon="arrow_back"
            :disable="saving"
            label="Back to profiles"
            @click="backToList"
          />
          <FormErrorSummary ref="summaryRef" :errors="formErrors" />
          <q-banner
            v-if="saveError"
            rounded
            class="manager-banner manager-banner--danger"
            role="alert"
            >{{ saveError }}</q-banner
          >
          <q-input
            v-model="form.name"
            outlined
            :for="`${kind}-profile-name`"
            :label="`${titleCase} name`"
            :rules="[required]"
            :disable="saving"
            maxlength="160"
          />
          <q-select
            v-if="kind === 'supplier'"
            v-model="form.supplierKind"
            outlined
            for="supplier-profile-kind"
            label="Supplier type"
            :options="supplierKinds"
            emit-value
            map-options
            :behavior="selectBehavior"
            :rules="[required]"
            :disable="saving"
          />
          <q-input
            v-model="form.contactName"
            outlined
            label="Contact person"
            autocomplete="off"
            :disable="saving"
            maxlength="120"
          />
          <q-input
            v-model="form.phone"
            outlined
            label="Phone number"
            type="tel"
            autocomplete="off"
            :disable="saving"
            maxlength="40"
          />
          <q-input
            v-model="form.email"
            outlined
            :for="`${kind}-profile-email`"
            label="Contact email"
            type="email"
            autocomplete="off"
            :rules="[emailRule]"
            :disable="saving"
            maxlength="254"
          />
          <q-input
            v-if="kind === 'retailer'"
            v-model="form.deliveryLocation"
            outlined
            label="Delivery location"
            :disable="saving"
            maxlength="300"
          />
          <q-input
            v-model="form.notes"
            outlined
            label="Notes"
            type="textarea"
            autogrow
            :disable="saving"
            maxlength="2000"
          />
          <q-toggle
            v-model="form.isActive"
            :label="`${titleCase} active`"
            :disable="saving"
            class="partner-status-toggle"
          />
          <q-banner
            v-if="!form.isActive"
            rounded
            class="manager-banner manager-banner--warning"
          >
            Inactive {{ kind }}s remain in historical records but are removed
            from new transaction pickers.
          </q-banner>
        </q-card-section>
        <q-card-actions align="right" class="q-pa-md">
          <q-btn
            flat
            no-caps
            label="Cancel"
            :disable="saving"
            @click="backToList"
          />
          <q-btn
            color="primary"
            no-caps
            label="Save profile"
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
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { apiRequest } from '@/lib/api'
import { required } from '@/lib/validation'
import { canWrite } from '@/constants/capabilities'
import { authState } from '@/services/auth'
import { collectFieldErrors, useFormErrors } from '@/composables/useFormErrors'
import FormErrorSummary from './FormErrorSummary.vue'

const props = defineProps({
  kind: {
    type: String,
    required: true,
    validator: value => ['supplier', 'retailer'].includes(value)
  },
  /**
   * v-model:open. Controls the dialog from outside, e.g. from a PageHeader
   * overflow item. Leave unset to use the built-in button only.
   */
  open: { type: Boolean, default: undefined },
  /** Hide the built-in "Manage suppliers/retailers" button. */
  hideTrigger: Boolean
})
const emit = defineEmits(['saved', 'update:open'])
const $q = useQuasar()
// MF-17: touch-friendly dialog pickers on phones, keyboard menus elsewhere.
const selectBehavior = computed(() => ($q.screen.lt.sm ? 'dialog' : 'menu'))
const formRef = ref(null)
const {
  errors: formErrors,
  summaryRef,
  fail,
  clear: clearErrors
} = useFormErrors()
const dialogOpen = ref(false),
  editing = ref(false),
  loading = ref(false),
  saving = ref(false)
const partners = ref([]),
  search = ref(''),
  statusFilter = ref('all')
const loadError = ref(''),
  saveError = ref(''),
  notice = ref('')
const form = reactive({
  id: null,
  name: '',
  supplierKind: 'mixed',
  contactName: '',
  phone: '',
  email: '',
  deliveryLocation: '',
  notes: '',
  isActive: true
})
const titleCase = computed(() =>
  props.kind === 'supplier' ? 'Supplier' : 'Retailer'
)
// Profile editing uses the same role sets as creating the partner
// (`write:suppliers` / `write:retailers`).
const allowed = computed(() => canWrite(authState.role, `${props.kind}s`))
const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
]
const supplierKinds = [
  { label: 'Raw honey', value: 'raw_honey' },
  { label: 'Packaging', value: 'packaging' },
  { label: 'Spice', value: 'spice' },
  { label: 'Honey and packaging', value: 'mixed' }
]
const supplierKindLabel = value =>
  supplierKinds.find(option => option.value === value)?.label ?? 'Supplier'
const filteredPartners = computed(() => {
  const term = (search.value || '').trim().toLowerCase()
  return partners.value.filter(partner => {
    if (statusFilter.value === 'active' && !partner.is_active) return false
    if (statusFilter.value === 'inactive' && partner.is_active) return false
    return [
      partner.name,
      partner.contact_name,
      partner.phone,
      partner.email,
      partner.delivery_location
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term)
  })
})
const emailRule = value =>
  !value ||
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ||
  'Enter a valid email address.'
async function openManager() {
  if (!allowed.value) return
  dialogOpen.value = true
  editing.value = false
  clearErrors()
  notice.value = ''
  await loadPartners()
}
/** Open the profile list. */
function show() {
  return openManager()
}
/** Close the dialog. Refused (returns false) while a save is in flight. */
function hide() {
  if (saving.value) return false
  dialogOpen.value = false
  editing.value = false
  clearErrors()
  return true
}
watch(dialogOpen, value => {
  if (value !== props.open) emit('update:open', value)
})
watch(
  () => props.open,
  value => {
    if (value === true && !dialogOpen.value) show()
    else if (value === false && dialogOpen.value && !hide())
      emit('update:open', true)
  },
  { immediate: true }
)
async function onInvalid() {
  await nextTick()
  await fail(collectFieldErrors(formRef))
}
function backToList() {
  editing.value = false
  clearErrors()
}
async function loadPartners() {
  loading.value = true
  loadError.value = ''
  try {
    partners.value = (await apiRequest(`partners?kind=${props.kind}`)).partners
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}
function editPartner(partner) {
  Object.assign(form, {
    id: partner.id,
    name: partner.name,
    supplierKind: partner.supplier_kind ?? 'mixed',
    contactName: partner.contact_name ?? '',
    phone: partner.phone ?? '',
    email: partner.email ?? '',
    deliveryLocation: partner.delivery_location ?? '',
    notes: partner.notes ?? '',
    isActive: partner.is_active
  })
  saveError.value = ''
  clearErrors()
  editing.value = true
}
async function saveProfile() {
  if (saving.value) return
  saving.value = true
  saveError.value = ''
  notice.value = ''
  clearErrors()
  const body = {
    kind: props.kind,
    id: form.id,
    name: form.name.trim(),
    supplierKind: props.kind === 'supplier' ? form.supplierKind : null,
    contactName: form.contactName.trim(),
    phone: form.phone.trim(),
    email: form.email.trim().toLowerCase(),
    deliveryLocation:
      props.kind === 'retailer' ? form.deliveryLocation.trim() : '',
    notes: form.notes.trim(),
    isActive: form.isActive
  }
  try {
    await apiRequest('partners', {
      method: 'PATCH',
      body: JSON.stringify(body)
    })
    notice.value = `${titleCase.value} profile saved.`
    editing.value = false
    await loadPartners()
    emit('saved', { id: form.id, isActive: form.isActive })
  } catch (error) {
    saveError.value =
      error.kind === 'network'
        ? 'The result could not be confirmed. Return to the profile list and refresh before trying again.'
        : error.message
  } finally {
    saving.value = false
  }
}

defineExpose({ show, hide, openManager })
</script>

<style scoped>
.partner-manager {
  width: 760px;
  max-width: 100%;
}

.manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-2);
}

.manager-title {
  margin: 0;
  color: var(--boms-color-heading);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: normal;
}

.manager-banner--success {
  background: var(--boms-color-success-bg);
  color: var(--boms-color-success-text);
}

.manager-banner--danger {
  background: var(--boms-color-danger-bg);
  color: var(--boms-color-danger-text);
}

.manager-banner--warning {
  background: var(--boms-color-warning-bg);
  color: var(--boms-color-warning-text);
}

.partner-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: var(--boms-space-3);
}

.partner-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: var(--boms-space-3);
}

.partner-profile-card {
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  padding: var(--boms-space-3) var(--boms-space-4);
  min-width: 0;
}

.partner-card-copy {
  min-width: 0;
  overflow-wrap: anywhere;
}

.partner-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: normal;
}

.profile-details {
  display: grid;
  gap: var(--boms-space-1);
  color: var(--boms-color-text-muted);
  overflow-wrap: anywhere;
}

.partner-status-toggle {
  min-height: 44px;
}

@media (max-width: 599px) {
  .partner-filters {
    grid-template-columns: 1fr;
  }
}
</style>
