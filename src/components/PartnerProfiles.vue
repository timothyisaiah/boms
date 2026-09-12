<template>
  <q-btn
    v-if="allowed"
    flat
    color="secondary"
    no-caps
    icon="manage_search"
    :label="`Manage ${kind}s`"
    @click="openManager"
  />

  <q-dialog v-model="open" persistent :maximized="$q.screen.lt.sm">
    <q-card class="partner-manager">
      <q-card-section class="row items-center justify-between q-gutter-sm">
        <div>
          <div class="section-label">Profiles</div>
          <h2 class="text-h6 q-my-none">
            {{ editing ? `Edit ${kind}` : `Manage ${kind}s` }}
          </h2>
        </div>
        <q-btn
          flat
          round
          icon="close"
          :aria-label="`Close ${kind} profiles`"
          :disable="saving"
          @click="closeManager"
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
            class="bg-green-1 q-mb-md"
            role="status"
          >
            {{ notice }}
          </q-banner>
          <q-banner
            v-if="loadError"
            rounded
            class="bg-red-1 q-mb-md"
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
              behavior="dialog"
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
                  <div class="text-weight-bold">{{ partner.name }}</div>
                  <div class="text-caption">
                    {{
                      kind === 'supplier'
                        ? supplierKindLabel(partner.supplier_kind)
                        : partner.delivery_location || 'No delivery location'
                    }}
                  </div>
                </div>
                <q-chip :color="partner.is_active ? 'green-1' : 'grey-3'">
                  {{ partner.is_active ? 'Active' : 'Inactive' }}
                </q-chip>
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

      <q-form v-else @submit.prevent="saveProfile">
        <q-card-section class="q-gutter-md q-pt-none">
          <q-btn
            flat
            no-caps
            icon="arrow_back"
            :disable="saving"
            label="Back to profiles"
            @click="editing = false"
          />
          <q-banner v-if="saveError" rounded class="bg-red-1" role="alert">{{
            saveError
          }}</q-banner>
          <q-input
            v-model="form.name"
            outlined
            :label="`${titleCase} name`"
            :rules="[required]"
            :disable="saving"
            maxlength="160"
          />
          <q-select
            v-if="kind === 'supplier'"
            v-model="form.supplierKind"
            outlined
            label="Supplier type"
            :options="supplierKinds"
            emit-value
            map-options
            behavior="dialog"
            :rules="[required]"
            :disable="saving"
          />
          <q-input
            v-model="form.contactName"
            outlined
            label="Contact person"
            :disable="saving"
            maxlength="120"
          />
          <q-input
            v-model="form.phone"
            outlined
            label="Phone number"
            type="tel"
            :disable="saving"
            maxlength="40"
          />
          <q-input
            v-model="form.email"
            outlined
            label="Contact email"
            type="email"
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
          <q-banner v-if="!form.isActive" rounded class="bg-amber-1">
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
            @click="editing = false"
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
import { computed, reactive, ref } from 'vue'
import { apiRequest } from '@/lib/api'
import { required } from '@/lib/validation'
import { authState } from '@/services/auth'

const props = defineProps({
  kind: {
    type: String,
    required: true,
    validator: value => ['supplier', 'retailer'].includes(value)
  }
})
const emit = defineEmits(['saved'])
const open = ref(false),
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
const allowed = computed(() =>
  [
    'admin_owner',
    'operations_manager',
    'warehouse_staff',
    ...(props.kind === 'retailer' ? ['sales_or_distribution_staff'] : [])
  ].includes(authState.role)
)
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
  open.value = true
  editing.value = false
  notice.value = ''
  await loadPartners()
}
function closeManager() {
  if (!saving.value) {
    open.value = false
    editing.value = false
  }
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
  editing.value = true
}
async function saveProfile() {
  if (saving.value) return
  saving.value = true
  saveError.value = ''
  notice.value = ''
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
</script>

<style scoped>
.partner-manager {
  width: 760px;
  max-width: 100%;
}

.partner-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 12px;
}

.partner-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 14px;
}

.partner-profile-card {
  border: 1px solid #eadfce;
  border-radius: 16px;
  padding: 16px;
  min-width: 0;
}

.partner-card-copy {
  min-width: 0;
  overflow-wrap: anywhere;
}

.profile-details {
  display: grid;
  gap: 4px;
  color: #6f6254;
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
