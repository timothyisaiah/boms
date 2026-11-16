<template>
  <template v-if="!hideTrigger">
    <q-btn
      v-if="canManage"
      outline
      color="primary"
      no-caps
      icon="add"
      label="Add material"
      @click="openCreate"
    />
    <q-btn
      flat
      color="secondary"
      no-caps
      icon="inventory_2"
      label="Manage materials"
      @click="openManager"
    />
  </template>

  <q-dialog
    v-model="dialogOpen"
    persistent
    :maximized="$q.screen.lt.sm"
    aria-labelledby="material-manager-title"
  >
    <q-card class="material-manager">
      <q-card-section class="manager-header">
        <h2 id="material-manager-title" class="manager-title">{{
          editing
            ? form.id
              ? 'Edit material'
              : 'Add material'
            : 'Manage materials'
        }}</h2>
        <q-btn
          flat
          round
          icon="close"
          aria-label="Close material manager"
          :disable="pending"
          @click="hide"
        />
      </q-card-section>

      <q-card-section class="q-pt-none">
        <WriteStatus
          v-if="canManage"
          v-show="writeStates.materials?.status !== 'success'"
          action="materials"
          @saved="saved"
        />
        <q-banner
          v-if="notice"
          rounded
          class="manager-banner manager-banner--success q-mb-md"
          role="status"
          >{{ notice }}</q-banner
        >
        <q-banner
          v-if="loadError"
          rounded
          class="manager-banner manager-banner--danger q-mb-md"
          role="alert"
        >
          {{ loadError }}
          <template #action
            ><q-btn
              flat
              no-caps
              label="Retry loading materials"
              @click="loadMaterials"
          /></template>
        </q-banner>

        <template v-if="!editing">
          <p
            >Manage raw honey and packaging. Record a receipt to add stock;
            available quantities come from open lots.</p
          >
          <q-btn
            v-if="canManage"
            outline
            color="primary"
            no-caps
            icon="add"
            label="Add material"
            class="q-mb-md"
            :disable="locked"
            @click="createMaterial"
          />
          <div class="material-filters q-mb-md">
            <q-input
              v-model="search"
              outlined
              clearable
              label="Search materials"
              placeholder="Name, code or description"
            />
            <q-select
              v-model="statusFilter"
              outlined
              label="Material status"
              :options="statusOptions"
              emit-value
              map-options
              :behavior="selectBehavior"
            />
            <q-select
              v-model="kindFilter"
              outlined
              label="Filter by type"
              :options="[{ label: 'All types', value: 'all' }, ...kindOptions]"
              emit-value
              map-options
              :behavior="selectBehavior"
            />
          </div>
          <q-linear-progress
            v-if="loading"
            indeterminate
            aria-label="Loading materials"
          />
          <div v-else class="material-list">
            <article
              v-for="material in filteredMaterials"
              :key="material.id"
              class="material-card"
            >
              <div class="row items-start justify-between q-gutter-sm">
                <div class="material-copy">
                  <h3 class="material-name">{{ material.name }}</h3>
                  <div class="text-caption"
                    >{{ material.code }} · {{ kindLabel(material.kind) }} ·
                    {{ material.unit_of_measure }}</div
                  >
                </div>
                <span
                  class="status-chip"
                  :class="
                    material.is_active
                      ? 'status-chip--success'
                      : 'status-chip--neutral'
                  "
                  >{{ material.is_active ? 'Active' : 'Inactive' }}</span
                >
              </div>
              <p v-if="material.description" class="q-mt-sm q-mb-none">{{
                material.description
              }}</p>
              <div class="q-mt-sm"
                >Available: {{ formatQuantity(material.quantity_on_hand) }}
                {{ material.unit_of_measure }}</div
              >
              <div class="text-caption"
                >Low-stock threshold:
                {{ formatQuantity(material.low_stock_threshold) }}
                {{ material.unit_of_measure }}</div
              >
              <span
                v-if="isLowStock(material)"
                class="status-chip status-chip--warning q-mt-sm"
                >Low stock</span
              >
              <div v-if="canManage">
                <q-btn
                  flat
                  color="primary"
                  no-caps
                  label="Edit material"
                  :aria-label="`Edit ${material.name}`"
                  :disable="locked"
                  class="q-mt-sm"
                  @click="editMaterial(material)"
                />
              </div>
            </article>
          </div>
          <p
            v-if="!loading && !loadError && !filteredMaterials.length"
            class="q-mt-md"
            >No materials match this search and filters.</p
          >
        </template>

        <q-form
          v-else
          ref="formRef"
          class="q-gutter-md"
          greedy
          no-error-focus
          @submit.prevent="saveMaterial"
          @validation-error="onInvalid"
        >
          <q-btn
            flat
            no-caps
            icon="arrow_back"
            label="Back to materials"
            :disable="pending"
            @click="backToList"
          />
          <FormErrorSummary ref="summaryRef" :errors="formErrors" />
          <q-input
            v-model="form.code"
            outlined
            for="material-code"
            label="Material code"
            maxlength="80"
            :rules="[required]"
            :disable="locked"
            hint="A unique reference, for example JAR-500."
          />
          <q-input
            v-model="form.name"
            outlined
            for="material-name"
            label="Material name"
            maxlength="160"
            :rules="[required]"
            :disable="locked"
          />
          <q-select
            v-model="form.kind"
            outlined
            for="material-kind"
            label="Material type"
            :options="kindOptions"
            emit-value
            map-options
            :behavior="selectBehavior"
            :rules="[required]"
            :disable="locked || !!form.id"
          />
          <q-input
            v-model="form.unitOfMeasure"
            outlined
            for="material-unit"
            label="Unit of measure"
            maxlength="40"
            :rules="[required]"
            :disable="locked || !!form.id"
            hint="Use the unit received and consumed, for example kg or pieces."
          />
          <p v-if="form.id" class="text-caption"
            >Type and unit are fixed after creation to keep stock quantities and
            costing consistent. Add a new material for a different type or
            unit.</p
          >
          <q-input
            v-model="form.lowStockThreshold"
            outlined
            for="material-threshold"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.001"
            label="Low-stock threshold"
            :suffix="form.unitOfMeasure"
            :rules="[thresholdRule]"
            :disable="locked"
            hint="Alert when available stock reaches this quantity or falls below it."
          />
          <q-input
            v-model="form.description"
            outlined
            for="material-description"
            label="Description"
            type="textarea"
            autogrow
            maxlength="2000"
            :disable="locked"
          />
          <q-toggle
            v-model="form.isActive"
            label="Material active"
            :disable="locked"
            class="material-status-toggle"
          />
          <q-banner
            v-if="!form.isActive"
            rounded
            class="manager-banner manager-banner--warning"
            >Inactive materials cannot be selected for new receipts. Existing
            lots and transaction history remain available.</q-banner
          >
          <div class="row justify-end q-gutter-sm">
            <q-btn
              flat
              no-caps
              label="Cancel"
              :disable="pending"
              @click="backToList"
            />
            <q-btn
              type="submit"
              color="primary"
              no-caps
              label="Save material"
              :disable="locked"
              :loading="pending"
            />
          </div>
        </q-form>
      </q-card-section>
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
import { isWriteLocked, writeAction, writeStates } from '@/services/writes'
import { collectFieldErrors, useFormErrors } from '@/composables/useFormErrors'
import FormErrorSummary from './FormErrorSummary.vue'
import WriteStatus from './WriteStatus.vue'

const props = defineProps({
  /**
   * v-model:open. Controls the dialog from outside, e.g. from a PageHeader
   * overflow item. Leave unset to use the built-in buttons only.
   */
  open: { type: Boolean, default: undefined },
  /** View shown when `open` becomes true: 'list' (manage) or 'create'. */
  view: {
    type: String,
    default: 'list',
    validator: value => ['list', 'create'].includes(value)
  },
  /** Hide the built-in "Add material" / "Manage materials" buttons. */
  hideTrigger: Boolean
})
const emit = defineEmits(['saved', 'update:open'])
const $q = useQuasar()
const canManage = computed(() => canWrite(authState.role, 'materials'))
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
  loadError = ref(''),
  notice = ref('')
const materials = ref([]),
  search = ref(''),
  statusFilter = ref('all'),
  kindFilter = ref('all')
const blankForm = () => ({
  code: '',
  name: '',
  kind: 'raw_honey',
  unitOfMeasure: 'kg',
  description: '',
  lowStockThreshold: '0',
  isActive: true
})
const form = reactive(blankForm())
const pending = computed(() => writeStates.materials?.status === 'pending')
const locked = computed(() => !canManage.value || isWriteLocked('materials'))
const kindOptions = [
  { label: 'Raw honey', value: 'raw_honey' },
  { label: 'Packaging', value: 'packaging' },
  { label: 'Spice', value: 'spice' }
]
const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
]
const kindLabel = kind =>
  kindOptions.find(option => option.value === kind)?.label ?? kind
const formatQuantity = value =>
  Number(value ?? 0).toLocaleString('en-UG', { maximumFractionDigits: 3 })
const isLowStock = material =>
  material.is_active &&
  Number(material.quantity_on_hand) <= Number(material.low_stock_threshold)
const thresholdRule = value =>
  (/^\d+(\.\d{1,3})?$/.test(String(value)) && Number(value) < 1e11) ||
  'Enter zero or a positive quantity with up to three decimal places.'
const filteredMaterials = computed(() => {
  const term = (search.value ?? '').trim().toLowerCase()
  return materials.value.filter(
    material =>
      (statusFilter.value === 'all' ||
        material.is_active === (statusFilter.value === 'active')) &&
      (kindFilter.value === 'all' || material.kind === kindFilter.value) &&
      [material.name, material.code, material.description].some(value =>
        String(value ?? '')
          .toLowerCase()
          .includes(term)
      )
  )
})
function setForm(value) {
  for (const key of Object.keys(form)) delete form[key]
  Object.assign(form, value)
}
function createMaterial() {
  if (locked.value) return
  setForm(blankForm())
  clearErrors()
  notice.value = ''
  editing.value = true
}
async function openCreate() {
  if (!canManage.value) return openManager()
  dialogOpen.value = true
  clearErrors()
  if (isWriteLocked('materials')) {
    setForm(writeStates.materials.body)
    editing.value = true
  } else createMaterial()
}
async function openManager() {
  dialogOpen.value = true
  editing.value = false
  clearErrors()
  notice.value = ''
  await loadMaterials()
}
/** Open the dialog on 'list' (manage) or 'create'. */
function show(view = 'list') {
  return view === 'create' ? openCreate() : openManager()
}
/** Close the dialog. Refused (returns false) while a save is pending. */
function hide() {
  if (pending.value) return false
  dialogOpen.value = false
  return true
}
watch(dialogOpen, value => {
  if (value !== props.open) emit('update:open', value)
})
watch(
  () => props.open,
  value => {
    if (value === true && !dialogOpen.value) show(props.view)
    else if (value === false && dialogOpen.value && !hide())
      emit('update:open', true)
  },
  { immediate: true }
)
async function onInvalid() {
  await nextTick()
  await fail(collectFieldErrors(formRef))
}
async function loadMaterials() {
  loading.value = true
  loadError.value = ''
  try {
    materials.value = (await apiRequest('materials')).materials
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}
function editMaterial(material) {
  setForm({
    id: material.id,
    code: material.code,
    name: material.name,
    kind: material.kind,
    unitOfMeasure: material.unit_of_measure,
    description: material.description ?? '',
    lowStockThreshold: String(material.low_stock_threshold),
    isActive: material.is_active
  })
  clearErrors()
  notice.value = ''
  editing.value = true
}
async function backToList() {
  editing.value = false
  clearErrors()
  await loadMaterials()
}
async function saved(result) {
  notice.value = 'Material saved.'
  editing.value = false
  search.value = ''
  statusFilter.value = 'all'
  kindFilter.value = 'all'
  emit('saved', result)
  await loadMaterials()
}
async function saveMaterial() {
  if (locked.value) return
  clearErrors()
  try {
    const result = await writeAction(
      'materials',
      JSON.parse(JSON.stringify(form))
    )
    await saved(result)
  } catch {
    /* WriteStatus preserves the submission and offers a safe retry. */
  }
}

defineExpose({ show, hide, openManager, openCreate })
</script>

<style scoped>
.material-manager {
  width: 780px;
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

.material-filters,
.material-list {
  display: grid;
  gap: var(--boms-space-3);
}

.material-card {
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  padding: var(--boms-space-3) var(--boms-space-4);
  overflow-wrap: anywhere;
}

.material-copy {
  flex: 1;
  min-width: 0;
}

.material-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: normal;
}

.material-status-toggle {
  min-height: 44px;
}

@media (min-width: 600px) {
  .material-filters {
    grid-template-columns: 2fr 1fr 1fr;
  }

  .material-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
