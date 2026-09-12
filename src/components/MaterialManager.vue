<template>
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

  <q-dialog v-model="open" persistent :maximized="$q.screen.lt.sm">
    <q-card class="material-manager">
      <q-card-section class="row items-center justify-between q-gutter-sm">
        <div>
          <div class="section-label">Supply catalogue</div>
          <h2 class="text-h6 q-my-none">{{
            editing
              ? form.id
                ? 'Edit material'
                : 'Add material'
              : 'Manage materials'
          }}</h2>
        </div>
        <q-btn
          flat
          round
          icon="close"
          aria-label="Close material manager"
          :disable="pending"
          @click="open = false"
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
          class="bg-green-1 q-mb-md"
          role="status"
          >{{ notice }}</q-banner
        >
        <q-banner
          v-if="loadError"
          rounded
          class="bg-red-1 q-mb-md"
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
              behavior="dialog"
            />
            <q-select
              v-model="kindFilter"
              outlined
              label="Filter by type"
              :options="[{ label: 'All types', value: 'all' }, ...kindOptions]"
              emit-value
              map-options
              behavior="dialog"
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
                  <div class="text-weight-bold">{{ material.name }}</div>
                  <div class="text-caption"
                    >{{ material.code }} · {{ kindLabel(material.kind) }} ·
                    {{ material.unit_of_measure }}</div
                  >
                </div>
                <q-chip :color="material.is_active ? 'green-1' : 'grey-3'">{{
                  material.is_active ? 'Active' : 'Inactive'
                }}</q-chip>
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
              <q-chip
                v-if="isLowStock(material)"
                color="amber-2"
                text-color="brown-10"
                >Low stock</q-chip
              >
              <q-btn
                v-if="canManage"
                flat
                color="primary"
                no-caps
                label="Edit material"
                :aria-label="`Edit ${material.name}`"
                :disable="locked"
                class="q-mt-sm"
                @click="editMaterial(material)"
              />
            </article>
          </div>
          <p
            v-if="!loading && !loadError && !filteredMaterials.length"
            class="q-mt-md"
            >No materials match this search and filters.</p
          >
        </template>

        <q-form v-else class="q-gutter-md" @submit.prevent="saveMaterial">
          <q-btn
            flat
            no-caps
            icon="arrow_back"
            label="Back to materials"
            :disable="pending"
            @click="backToList"
          />
          <q-input
            v-model="form.code"
            outlined
            label="Material code"
            maxlength="80"
            :rules="[required]"
            :disable="locked"
            hint="A unique reference, for example JAR-500."
          />
          <q-input
            v-model="form.name"
            outlined
            label="Material name"
            maxlength="160"
            :rules="[required]"
            :disable="locked"
          />
          <q-select
            v-model="form.kind"
            outlined
            label="Material type"
            :options="kindOptions"
            emit-value
            map-options
            behavior="dialog"
            :rules="[required]"
            :disable="locked || !!form.id"
          />
          <q-input
            v-model="form.unitOfMeasure"
            outlined
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
          <q-banner v-if="!form.isActive" rounded class="bg-amber-1"
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
import { computed, reactive, ref } from 'vue'
import { apiRequest } from '@/lib/api'
import { required } from '@/lib/validation'
import { authState } from '@/services/auth'
import { isWriteLocked, writeAction, writeStates } from '@/services/writes'
import WriteStatus from './WriteStatus.vue'

const emit = defineEmits(['saved'])
const canManage = computed(() =>
  ['admin_owner', 'operations_manager', 'warehouse_staff'].includes(
    authState.role
  )
)
const open = ref(false),
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
  notice.value = ''
  editing.value = true
}
async function openCreate() {
  open.value = true
  if (isWriteLocked('materials')) {
    setForm(writeStates.materials.body)
    editing.value = true
  } else createMaterial()
}
async function openManager() {
  open.value = true
  editing.value = false
  notice.value = ''
  await loadMaterials()
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
  notice.value = ''
  editing.value = true
}
async function backToList() {
  editing.value = false
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
</script>

<style scoped>
.material-manager {
  width: 780px;
  max-width: 100%;
}

.material-filters,
.material-list {
  display: grid;
  gap: 16px;
}

.material-card {
  border: 1px solid #e3ddd2;
  border-radius: 16px;
  padding: 16px;
  overflow-wrap: anywhere;
}

.material-copy {
  flex: 1;
  min-width: 0;
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
