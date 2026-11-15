<template>
  <template v-if="!hideTrigger">
    <q-btn
      v-if="canManage"
      outline
      color="primary"
      no-caps
      icon="add"
      label="Add variant"
      @click="openCreate"
    />
    <q-btn
      flat
      color="secondary"
      no-caps
      icon="category"
      label="Manage variants"
      @click="openManager"
    />
  </template>

  <q-dialog
    v-model="dialogOpen"
    persistent
    :maximized="$q.screen.lt.sm"
    aria-labelledby="variant-manager-title"
  >
    <q-card class="variant-manager">
      <q-card-section class="manager-header">
        <h2 id="variant-manager-title" class="manager-title">
          {{
            editing
              ? form.id
                ? 'Edit variant'
                : 'Add variant'
              : 'Manage variants'
          }}
        </h2>
        <q-btn
          flat
          round
          icon="close"
          aria-label="Close variant manager"
          :disable="pending"
          @click="hide"
        />
      </q-card-section>

      <q-card-section class="q-pt-none">
        <WriteStatus
          v-if="canManage"
          v-show="writeStates.variants?.status !== 'success'"
          action="variants"
          @saved="saved"
        />
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
            <q-btn
              flat
              no-caps
              label="Retry loading variants"
              @click="loadCatalogue"
            />
          </template>
        </q-banner>

        <template v-if="!editing">
          <p>
            Add the sizes and flavours you produce. Active variants are
            available immediately when creating a production batch.
          </p>
          <q-btn
            v-if="canManage"
            outline
            color="primary"
            no-caps
            icon="add"
            label="Add variant"
            class="q-mb-md"
            :disable="locked"
            @click="createVariant"
          />
          <div class="variant-filters q-mb-md">
            <q-input
              v-model="search"
              outlined
              clearable
              label="Search variants"
              placeholder="Product, SKU, flavour or packaging"
            />
            <q-select
              v-model="statusFilter"
              outlined
              label="Variant status"
              :options="statusOptions"
              emit-value
              map-options
              :behavior="selectBehavior"
            />
          </div>
          <q-linear-progress
            v-if="loading"
            indeterminate
            aria-label="Loading variants"
          />
          <div v-else class="variant-list">
            <article
              v-for="variant in filteredVariants"
              :key="variant.id"
              class="variant-card"
            >
              <div class="row items-start justify-between q-gutter-sm">
                <div class="variant-copy">
                  <h3 class="variant-name">{{ variant.variant_name }}</h3>
                  <div class="text-caption">
                    {{ variant.product?.name ?? 'Product' }} · {{ variant.sku }}
                  </div>
                </div>
                <span
                  class="status-chip"
                  :class="
                    variant.is_active
                      ? 'status-chip--success'
                      : 'status-chip--neutral'
                  "
                >
                  {{ variant.is_active ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <div class="q-mt-sm">
                {{ variant.flavor }} ·
                {{ formatQuantity(variant.pack_size_grams) }}g ·
                {{ variant.packaging_type }}
              </div>
              <div class="text-caption">
                Low-stock threshold:
                {{ formatQuantity(variant.low_stock_threshold) }} units
              </div>
              <span
                v-if="isLowStock(variant)"
                class="status-chip status-chip--warning q-mt-sm"
              >
                Low stock
              </span>
              <div v-if="canManage">
                <q-btn
                  flat
                  color="primary"
                  no-caps
                  label="Edit variant"
                  :aria-label="`Edit ${variant.variant_name}`"
                  :disable="locked"
                  class="q-mt-sm"
                  @click="editVariant(variant)"
                />
              </div>
            </article>
          </div>
          <p
            v-if="!loading && !loadError && !filteredVariants.length"
            class="q-mt-md"
          >
            No variants match this search and status.
          </p>
        </template>

        <q-form
          v-else
          ref="formRef"
          class="q-gutter-md"
          greedy
          no-error-focus
          @submit.prevent="saveVariant"
          @validation-error="onInvalid"
        >
          <q-btn
            flat
            no-caps
            icon="arrow_back"
            label="Back to variants"
            :disable="pending"
            @click="backToList"
          />
          <FormErrorSummary ref="summaryRef" :errors="formErrors" />
          <template v-if="!form.id">
            <q-toggle
              v-model="creatingProduct"
              label="Create a new product for this variant"
              :disable="locked"
              class="variant-toggle"
            />
            <q-select
              v-if="!creatingProduct"
              v-model="form.productId"
              outlined
              for="variant-product"
              emit-value
              map-options
              :behavior="selectBehavior"
              label="Product"
              :options="activeProductOptions"
              :rules="[productRule]"
              :disable="locked"
            />
            <template v-else>
              <q-input
                v-model="form.newProductName"
                outlined
                for="variant-new-product"
                label="New product name"
                maxlength="160"
                :rules="[required]"
                :disable="locked"
                hint="For example, Beecone Raw Natural Honey."
              />
              <q-input
                v-model="form.newProductDescription"
                outlined
                label="Product description"
                type="textarea"
                autogrow
                maxlength="2000"
                :disable="locked"
              />
            </template>
          </template>
          <q-input
            v-else
            outlined
            label="Product"
            :model-value="form.productName"
            disable
            hint="Product assignment stays fixed after creation to preserve batch history."
          />
          <q-input
            v-model="form.sku"
            outlined
            for="variant-sku"
            label="SKU"
            maxlength="80"
            :rules="[required]"
            :disable="locked"
            hint="A unique stock-keeping reference, for example HNY-500-CL."
          />
          <q-input
            v-model="form.variantName"
            outlined
            for="variant-name"
            label="Variant name"
            maxlength="160"
            :rules="[required]"
            :disable="locked"
            hint="For example, Classic honey 500g."
          />
          <q-input
            v-model="form.flavor"
            outlined
            for="variant-flavour"
            label="Flavour"
            maxlength="100"
            :rules="[required]"
            :disable="locked"
          />
          <q-input
            v-model.number="form.packSizeGrams"
            outlined
            for="variant-pack-size"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            label="Pack size (grams)"
            :rules="[positiveWhole]"
            :disable="locked"
          />
          <q-input
            v-model="form.packagingType"
            outlined
            for="variant-packaging"
            label="Packaging type"
            maxlength="100"
            :rules="[required]"
            :disable="locked"
            hint="For example, glass jar or squeeze bottle."
          />
          <q-input
            v-model.number="form.lowStockThreshold"
            outlined
            for="variant-threshold"
            type="number"
            inputmode="numeric"
            min="0"
            step="1"
            label="Low-stock threshold"
            suffix="units"
            :rules="[nonnegativeWhole]"
            :disable="locked"
            hint="Alert when finished stock reaches this quantity or falls below it."
          />
          <q-toggle
            v-model="form.isActive"
            label="Variant active"
            :disable="locked"
            class="variant-toggle"
          />
          <q-banner
            v-if="!form.isActive"
            rounded
            class="manager-banner manager-banner--warning"
          >
            Inactive variants cannot be selected for new production batches.
            Existing batches, finished stock and sales history remain available.
          </q-banner>
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
              label="Save variant"
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
  /** Hide the built-in "Add variant" / "Manage variants" buttons. */
  hideTrigger: Boolean
})
const emit = defineEmits(['saved', 'update:open'])
const $q = useQuasar()
const canManage = computed(() => canWrite(authState.role, 'variants'))
// MF-17: touch-friendly dialog pickers on phones, keyboard menus elsewhere.
const selectBehavior = computed(() => ($q.screen.lt.sm ? 'dialog' : 'menu'))
const formRef = ref(null)
const {
  errors: formErrors,
  summaryRef,
  fail,
  clear: clearErrors
} = useFormErrors()
const dialogOpen = ref(false)
const editing = ref(false)
const loading = ref(false)
const loadError = ref('')
const notice = ref('')
const variants = ref([])
const products = ref([])
const search = ref('')
const statusFilter = ref('all')
const creatingProduct = ref(false)
const blankForm = () => ({
  productId: null,
  newProductName: '',
  newProductDescription: '',
  sku: '',
  variantName: '',
  flavor: 'Classic',
  packSizeGrams: null,
  packagingType: 'Jar',
  lowStockThreshold: 0,
  isActive: true
})
const form = reactive(blankForm())
const pending = computed(() => writeStates.variants?.status === 'pending')
const locked = computed(() => !canManage.value || isWriteLocked('variants'))
const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
]
const activeProductOptions = computed(() =>
  products.value
    .filter(product => product.is_active)
    .map(product => ({ value: product.id, label: product.name }))
)
const formatQuantity = value => Number(value ?? 0).toLocaleString('en-UG')
const positiveWhole = value =>
  (Number.isInteger(value) && value > 0) ||
  'Enter a whole number greater than zero.'
const nonnegativeWhole = value =>
  (Number.isInteger(value) && value >= 0) || 'Enter zero or a whole number.'
const productRule = value =>
  Boolean(value) || 'Select a product or create a new one.'
const isLowStock = variant =>
  variant.is_active &&
  Number(variant.low_stock_threshold) > 0 &&
  Number(variant.quantity_on_hand) <= Number(variant.low_stock_threshold)
const filteredVariants = computed(() => {
  const term = (search.value ?? '').trim().toLowerCase()
  return variants.value.filter(
    variant =>
      (statusFilter.value === 'all' ||
        variant.is_active === (statusFilter.value === 'active')) &&
      [
        variant.product?.name,
        variant.sku,
        variant.variant_name,
        variant.flavor,
        variant.packaging_type
      ].some(value =>
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
function createVariant() {
  if (locked.value) return
  setForm(blankForm())
  clearErrors()
  creatingProduct.value = false
  notice.value = ''
  editing.value = true
}
async function openCreate() {
  if (!canManage.value) return openManager()
  dialogOpen.value = true
  clearErrors()
  if (isWriteLocked('variants')) {
    setForm(writeStates.variants.body)
    creatingProduct.value = Boolean(form.newProductName)
    editing.value = true
  } else {
    await loadCatalogue()
    createVariant()
  }
}
async function openManager() {
  dialogOpen.value = true
  editing.value = false
  clearErrors()
  notice.value = ''
  await loadCatalogue()
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
async function loadCatalogue() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await apiRequest('variants')
    variants.value = data.variants
    products.value = data.products
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}
function editVariant(variant) {
  setForm({
    id: variant.id,
    productId: variant.product_id,
    productName: variant.product?.name ?? 'Product',
    newProductName: '',
    newProductDescription: '',
    sku: variant.sku,
    variantName: variant.variant_name,
    flavor: variant.flavor,
    packSizeGrams: variant.pack_size_grams,
    packagingType: variant.packaging_type,
    lowStockThreshold: variant.low_stock_threshold,
    isActive: variant.is_active
  })
  clearErrors()
  notice.value = ''
  editing.value = true
}
async function backToList() {
  editing.value = false
  clearErrors()
  await loadCatalogue()
}
async function saved(result) {
  notice.value =
    'Variant saved. It is ready to select in a new production batch.'
  editing.value = false
  search.value = ''
  statusFilter.value = 'all'
  emit('saved', result)
  await loadCatalogue()
}
async function saveVariant() {
  if (locked.value) return
  clearErrors()
  try {
    const body = JSON.parse(JSON.stringify(form))
    delete body.productName
    if (!creatingProduct.value) {
      body.newProductName = ''
      body.newProductDescription = ''
    } else body.productId = null
    const result = await writeAction('variants', body)
    await saved(result)
  } catch {
    /* WriteStatus preserves the submission and offers a safe retry. */
  }
}

defineExpose({ show, hide, openManager, openCreate })
</script>

<style scoped>
.variant-manager {
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
.variant-filters,
.variant-list {
  display: grid;
  gap: var(--boms-space-3);
}
.variant-card {
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  padding: var(--boms-space-3) var(--boms-space-4);
  overflow-wrap: anywhere;
}
.variant-copy {
  flex: 1;
  min-width: 0;
}
.variant-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: normal;
}
.variant-toggle {
  min-height: 44px;
}
@media (min-width: 600px) {
  .variant-filters {
    grid-template-columns: 2fr 1fr;
  }
  .variant-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
