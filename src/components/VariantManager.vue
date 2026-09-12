<template>
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

  <q-dialog v-model="open" persistent :maximized="$q.screen.lt.sm">
    <q-card class="variant-manager">
      <q-card-section class="row items-center justify-between q-gutter-sm">
        <div>
          <div class="section-label">Product catalogue</div>
          <h2 class="text-h6 q-my-none">
            {{
              editing
                ? form.id
                  ? 'Edit variant'
                  : 'Add variant'
                : 'Manage variants'
            }}
          </h2>
        </div>
        <q-btn
          flat
          round
          icon="close"
          aria-label="Close variant manager"
          :disable="pending"
          @click="open = false"
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
              behavior="dialog"
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
                  <div class="text-weight-bold">{{ variant.variant_name }}</div>
                  <div class="text-caption">
                    {{ variant.product?.name ?? 'Product' }} · {{ variant.sku }}
                  </div>
                </div>
                <q-chip :color="variant.is_active ? 'green-1' : 'grey-3'">
                  {{ variant.is_active ? 'Active' : 'Inactive' }}
                </q-chip>
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
              <q-chip
                v-if="isLowStock(variant)"
                color="amber-2"
                text-color="brown-10"
              >
                Low stock
              </q-chip>
              <q-btn
                v-if="canManage"
                flat
                color="primary"
                no-caps
                label="Edit variant"
                :aria-label="`Edit ${variant.variant_name}`"
                :disable="locked"
                class="q-mt-sm"
                @click="editVariant(variant)"
              />
            </article>
          </div>
          <p
            v-if="!loading && !loadError && !filteredVariants.length"
            class="q-mt-md"
          >
            No variants match this search and status.
          </p>
        </template>

        <q-form v-else class="q-gutter-md" @submit.prevent="saveVariant">
          <q-btn
            flat
            no-caps
            icon="arrow_back"
            label="Back to variants"
            :disable="pending"
            @click="backToList"
          />
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
              emit-value
              map-options
              behavior="dialog"
              label="Product"
              :options="activeProductOptions"
              :rules="[productRule]"
              :disable="locked"
            />
            <template v-else>
              <q-input
                v-model="form.newProductName"
                outlined
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
            label="SKU"
            maxlength="80"
            :rules="[required]"
            :disable="locked"
            hint="A unique stock-keeping reference, for example HNY-500-CL."
          />
          <q-input
            v-model="form.variantName"
            outlined
            label="Variant name"
            maxlength="160"
            :rules="[required]"
            :disable="locked"
            hint="For example, Classic honey 500g."
          />
          <q-input
            v-model="form.flavor"
            outlined
            label="Flavour"
            maxlength="100"
            :rules="[required]"
            :disable="locked"
          />
          <q-input
            v-model.number="form.packSizeGrams"
            outlined
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
            label="Packaging type"
            maxlength="100"
            :rules="[required]"
            :disable="locked"
            hint="For example, glass jar or squeeze bottle."
          />
          <q-input
            v-model.number="form.lowStockThreshold"
            outlined
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
          <q-banner v-if="!form.isActive" rounded class="bg-amber-1">
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
import { computed, reactive, ref } from 'vue'
import { apiRequest } from '@/lib/api'
import { required } from '@/lib/validation'
import { authState } from '@/services/auth'
import { isWriteLocked, writeAction, writeStates } from '@/services/writes'
import WriteStatus from './WriteStatus.vue'

const emit = defineEmits(['saved'])
const canManage = computed(() =>
  ['admin_owner', 'operations_manager'].includes(authState.role)
)
const open = ref(false)
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
  creatingProduct.value = false
  notice.value = ''
  editing.value = true
}
async function openCreate() {
  open.value = true
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
  open.value = true
  editing.value = false
  notice.value = ''
  await loadCatalogue()
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
  notice.value = ''
  editing.value = true
}
async function backToList() {
  editing.value = false
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
</script>

<style scoped>
.variant-manager {
  width: 780px;
  max-width: 100%;
}
.variant-filters,
.variant-list {
  display: grid;
  gap: 16px;
}
.variant-card {
  border: 1px solid #e3ddd2;
  border-radius: 16px;
  padding: 16px;
  overflow-wrap: anywhere;
}
.variant-copy {
  flex: 1;
  min-width: 0;
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
