<template>
  <q-page class="page-layout">
    <section class="page-hero">
      <div>
        <p class="page-hero__eyebrow">Operations</p>
        <h1 class="page-hero__title">Supply and production</h1>
        <p class="page-hero__body">
          Receive materials, monitor open lots, and post traceable batches.
        </p>
      </div>

      <div class="page-hero__actions">
        <q-btn
          color="primary"
          no-caps
          icon="refresh"
          label="Refresh workspace"
          :loading="isLoading"
          @click="loadWorkspace"
        />
        <q-btn
          flat
          color="secondary"
          no-caps
          label="Back to dashboard"
          to="/"
        />
      </div>
    </section>

    <q-banner
      v-if="workspace.mode === 'preview'"
      rounded
      class="surface-card operations-banner bg-amber-1 text-brown-10"
    >
      Preview mode is active. Connect Supabase and apply the hosted migrations
      to unlock live purchasing and batching.
    </q-banner>

    <q-banner
      v-if="loadError"
      rounded
      class="surface-card operations-banner bg-orange-1 text-brown-10"
    >
      {{ loadError }}
    </q-banner>

    <q-banner
      v-if="actionFeedback.message"
      rounded
      :class="actionFeedbackClass"
      class="surface-card operations-banner"
    >
      {{ actionFeedback.message }}
    </q-banner>

    <section class="card-grid card-grid--three">
      <q-card
        v-for="metric in metrics"
        :key="metric.title"
        flat
        class="surface-card metric-card operations-metric-card"
      >
        <q-card-section>
          <div class="section-label">{{ metric.label }}</div>
          <div class="section-title">{{ metric.title }}</div>
          <div class="operations-metric-card__value">{{ metric.value }}</div>
          <p class="text-body2 text-grey-8 q-mt-sm">{{ metric.text }}</p>
        </q-card-section>
      </q-card>
    </section>

    <section class="card-grid card-grid--two">
      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Reference deck</div>
          <div class="section-title">
            Seeded variants, materials, and suppliers
          </div>
        </q-card-section>

        <q-card-section class="operations-reference-grid">
          <div>
            <div class="operations-subheading">Product variants</div>
            <div class="summary-pill-row q-mt-sm">
              <q-chip
                v-for="variant in workspace.variants"
                :key="variant.id"
                square
                color="amber-2"
                text-color="brown-10"
              >
                {{ variant.sku }} / {{ variant.variant_name }}
              </q-chip>
            </div>
          </div>

          <div>
            <div class="operations-subheading">Material catalogue</div>
            <div class="summary-pill-row q-mt-sm">
              <q-chip
                v-for="material in workspace.materials"
                :key="material.id"
                square
                color="green-1"
                text-color="green-10"
              >
                {{ material.name }} / {{ formatMaterialKind(material.kind) }}
              </q-chip>
            </div>
          </div>

          <div>
            <div class="operations-subheading">Supplier pool</div>
            <div class="summary-pill-row q-mt-sm">
              <q-chip
                v-for="supplier in workspace.suppliers"
                :key="supplier.id"
                square
                color="blue-1"
                text-color="blue-10"
              >
                {{ supplier.supplier_name }}
              </q-chip>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Open material lots</div>
          <div class="section-title">What production can consume right now</div>
        </q-card-section>

        <q-card-section v-if="openInventoryLots.length > 0" class="list-stack">
          <article
            v-for="lot in openInventoryLots"
            :key="lot.id"
            class="list-card"
          >
            <div class="detail-row">
              <strong>{{ lot.material?.name ?? 'Material lot' }}</strong>
              <q-chip square color="amber-2" text-color="brown-10">
                {{ lot.lot_code }}
              </q-chip>
            </div>

            <div class="text-body2 text-grey-8 q-mt-sm">
              {{ formatQuantity(lot.quantity_remaining) }}
              {{ lot.material?.unit_of_measure ?? 'units' }} remaining at
              {{ formatMoney(lot.unit_cost) }} each
            </div>

            <div class="text-caption text-grey-7 q-mt-xs">
              {{ lot.supplier?.supplier_name ?? 'Unknown supplier' }} / received
              {{ formatDate(lot.received_at) }}
            </div>
          </article>
        </q-card-section>

        <q-card-section v-else>
          <div class="empty-state">
            No open material lots yet. Record a purchase receipt to stock
            production.
          </div>
        </q-card-section>
      </q-card>
    </section>

    <section class="card-grid card-grid--two">
      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Purchasing workflow</div>
          <div class="section-title">Receive honey and packaging into lots</div>
        </q-card-section>

        <q-card-section>
          <q-banner
            v-if="purchaseWritesDisabled"
            rounded
            class="bg-grey-2 text-grey-9 q-mb-md"
          >
            Live purchase writes need a connected Supabase project with the
            latest migrations.
          </q-banner>

          <q-form @submit.prevent="submitPurchase">
            <div class="inline-form-grid">
              <q-select
                v-model="purchaseForm.supplierId"
                outlined
                emit-value
                map-options
                :disable="
                  purchaseWritesDisabled || supplierOptions.length === 0
                "
                :options="supplierOptions"
                label="Supplier"
              />

              <q-input
                v-model="purchaseForm.purchasedOn"
                outlined
                type="date"
                :disable="purchaseWritesDisabled"
                label="Purchase date"
              />

              <q-input
                v-model="purchaseForm.purchaseReference"
                outlined
                :disable="purchaseWritesDisabled"
                label="Reference"
                hint="Optional invoice or delivery note"
              />

              <q-input
                v-model="purchaseForm.notes"
                outlined
                type="textarea"
                autogrow
                :disable="purchaseWritesDisabled"
                label="Notes"
              />
            </div>

            <div class="operations-subheading q-mt-lg">Line items</div>

            <div class="line-item-stack q-mt-sm">
              <article
                v-for="(item, index) in purchaseForm.items"
                :key="item.key"
                class="line-item-card"
              >
                <div class="detail-row">
                  <strong>Line {{ index + 1 }}</strong>
                  <q-btn
                    v-if="purchaseForm.items.length > 1"
                    flat
                    round
                    dense
                    type="button"
                    color="negative"
                    icon="delete"
                    :disable="purchaseWritesDisabled"
                    @click="removePurchaseLine(item.key)"
                  />
                </div>

                <div class="line-item-grid q-mt-md">
                  <q-select
                    v-model="item.materialId"
                    outlined
                    emit-value
                    map-options
                    :disable="
                      purchaseWritesDisabled || materialOptions.length === 0
                    "
                    :options="materialOptions"
                    label="Material"
                  />

                  <q-input
                    v-model="item.quantity"
                    outlined
                    type="number"
                    min="0"
                    step="0.001"
                    :disable="purchaseWritesDisabled"
                    label="Quantity"
                  />

                  <q-input
                    v-model="item.unitCost"
                    outlined
                    type="number"
                    min="0"
                    step="0.01"
                    :disable="purchaseWritesDisabled"
                    label="Unit cost (UGX)"
                  />

                  <q-input
                    v-model="item.lotCode"
                    outlined
                    :disable="purchaseWritesDisabled"
                    label="Lot code"
                    hint="Optional, auto-generated when blank"
                  />
                </div>
              </article>
            </div>

            <div class="form-footer">
              <div class="summary-pill-row">
                <q-btn
                  flat
                  color="secondary"
                  no-caps
                  icon="add"
                  type="button"
                  label="Add line"
                  :disable="purchaseWritesDisabled"
                  @click="addPurchaseLine"
                />

                <q-chip square color="amber-2" text-color="brown-10">
                  Estimated receipt total: {{ formatMoney(purchaseTotal) }}
                </q-chip>
              </div>

              <q-btn
                color="primary"
                no-caps
                type="submit"
                label="Record purchase"
                :disable="purchaseWritesDisabled"
                :loading="isSubmittingPurchase"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>

      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Production workflow</div>
          <div class="section-title">
            Consume lots and create finished output
          </div>
        </q-card-section>

        <q-card-section>
          <q-banner
            v-if="batchWritesDisabled"
            rounded
            class="bg-grey-2 text-grey-9 q-mb-md"
          >
            Production entry unlocks after live material lots exist. Record at
            least one purchase receipt first, then create a batch from the open
            lots above.
          </q-banner>

          <q-form @submit.prevent="submitProductionBatch">
            <div class="inline-form-grid">
              <q-select
                v-model="batchForm.variantId"
                outlined
                emit-value
                map-options
                :disable="batchWritesDisabled || variantOptions.length === 0"
                :options="variantOptions"
                label="Finished variant"
              />

              <q-input
                v-model="batchForm.startedOn"
                outlined
                type="date"
                :disable="batchWritesDisabled"
                label="Batch date"
              />

              <q-input
                v-model="batchForm.batchCode"
                outlined
                :disable="batchWritesDisabled"
                label="Batch code"
                hint="Auto-suggested and incremented by date"
              />

              <q-input
                v-model="batchForm.outputQuantity"
                outlined
                type="number"
                min="1"
                step="1"
                :disable="batchWritesDisabled"
                label="Jars produced"
              />

              <q-input
                v-model="batchForm.notes"
                outlined
                type="textarea"
                autogrow
                :disable="batchWritesDisabled"
                label="Batch notes"
              />
            </div>

            <div class="operations-subheading q-mt-lg">Consumed inputs</div>

            <div class="line-item-stack q-mt-sm">
              <article
                v-for="(input, index) in batchForm.inputs"
                :key="input.key"
                class="line-item-card"
              >
                <div class="detail-row">
                  <strong>Input {{ index + 1 }}</strong>
                  <q-btn
                    v-if="batchForm.inputs.length > 1"
                    flat
                    round
                    dense
                    type="button"
                    color="negative"
                    icon="delete"
                    :disable="batchWritesDisabled"
                    @click="removeBatchInput(input.key)"
                  />
                </div>

                <div class="line-item-grid q-mt-md">
                  <q-select
                    v-model="input.inventoryLotId"
                    outlined
                    emit-value
                    map-options
                    :disable="
                      batchWritesDisabled || inventoryLotOptions.length === 0
                    "
                    :options="inventoryLotOptions"
                    label="Material lot"
                  />

                  <q-input
                    v-model="input.quantity"
                    outlined
                    type="number"
                    min="0"
                    step="0.001"
                    :disable="batchWritesDisabled"
                    label="Quantity consumed"
                  />
                </div>

                <div
                  v-if="resolveInventoryLot(input.inventoryLotId)"
                  class="text-caption text-grey-7 q-mt-sm"
                >
                  {{
                    resolveInventoryLot(input.inventoryLotId).material?.name ??
                    'Material'
                  }}
                  /
                  {{
                    formatQuantity(
                      resolveInventoryLot(input.inventoryLotId)
                        .quantity_remaining
                    )
                  }}
                  {{
                    resolveInventoryLot(input.inventoryLotId).material
                      ?.unit_of_measure ?? 'units'
                  }}
                  currently open at
                  {{
                    formatMoney(
                      resolveInventoryLot(input.inventoryLotId).unit_cost
                    )
                  }}
                </div>
              </article>
            </div>

            <div class="form-footer">
              <div class="summary-pill-row">
                <q-btn
                  flat
                  color="secondary"
                  no-caps
                  icon="add"
                  type="button"
                  label="Add input"
                  :disable="batchWritesDisabled"
                  @click="addBatchInput"
                />

                <q-chip square color="green-1" text-color="green-10">
                  Estimated input cost:
                  {{ formatMoney(estimatedBatchInputCost) }}
                </q-chip>

                <q-chip square color="blue-1" text-color="blue-10">
                  Estimated cost per jar:
                  {{ formatMoney(estimatedBatchUnitCost) }}
                </q-chip>
              </div>

              <q-btn
                color="primary"
                no-caps
                type="submit"
                label="Create production batch"
                :disable="batchWritesDisabled"
                :loading="isSubmittingBatch"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </section>

    <section class="card-grid card-grid--two">
      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Recent purchases</div>
          <div class="section-title">Material receipts now recorded</div>
        </q-card-section>

        <q-card-section
          v-if="workspace.purchases.length > 0"
          class="list-stack"
        >
          <article
            v-for="purchase in workspace.purchases"
            :key="purchase.id"
            class="list-card"
          >
            <div class="detail-row">
              <strong>{{ purchaseLabel(purchase) }}</strong>
              <q-chip square color="amber-2" text-color="brown-10">
                {{ formatMoney(purchase.total_amount) }}
              </q-chip>
            </div>

            <div class="text-body2 text-grey-8 q-mt-sm">
              {{ purchase.supplier?.supplier_name ?? 'Unknown supplier' }} /
              {{ formatDate(purchase.purchased_at) }}
            </div>

            <div class="summary-pill-row q-mt-sm">
              <q-chip
                v-for="item in purchase.items ?? []"
                :key="item.id"
                square
                color="grey-2"
                text-color="grey-9"
              >
                {{ item.material?.name ?? 'Material' }} /
                {{ formatQuantity(item.quantity) }}
                {{ item.material?.unit_of_measure ?? 'units' }}
              </q-chip>
            </div>
          </article>
        </q-card-section>

        <q-card-section v-else>
          <div class="empty-state">
            Purchases will appear here after the first honey or packaging
            receipt is recorded.
          </div>
        </q-card-section>
      </q-card>

      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Recent production batches</div>
          <div class="section-title">Traceable outputs with unit cost</div>
        </q-card-section>

        <q-card-section v-if="workspace.batches.length > 0" class="list-stack">
          <article
            v-for="batch in workspace.batches"
            :key="batch.id"
            class="list-card"
          >
            <div class="detail-row">
              <strong>{{ batch.batch_code }}</strong>
              <q-chip square color="blue-1" text-color="blue-10">
                {{ formatMoney(batch.output_unit_cost) }} / jar
              </q-chip>
            </div>

            <div class="text-body2 text-grey-8 q-mt-sm">
              {{ batch.variant?.variant_name ?? 'Unknown variant' }} /
              {{ batch.total_output_quantity }} jars /
              {{ formatDate(batch.started_at) }}
            </div>

            <div class="summary-pill-row q-mt-sm">
              <q-chip
                v-for="input in batch.inputs ?? []"
                :key="input.id"
                square
                color="grey-2"
                text-color="grey-9"
              >
                {{ input.material?.name ?? 'Material' }} /
                {{ formatQuantity(input.quantity_consumed) }}
                {{ input.material?.unit_of_measure ?? 'units' }}
              </q-chip>
            </div>
          </article>
        </q-card-section>

        <q-card-section v-else>
          <div class="empty-state">
            Production history starts once a batch consumes real lots. The
            resulting output cost then becomes the baseline for warehouse and
            retail phases.
          </div>
        </q-card-section>
      </q-card>
    </section>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import {
  fetchOperationsWorkspace,
  formatOperationsError,
  getPreviewOperationsWorkspace,
  recordProductionBatch,
  recordPurchase
} from '@/services/operations'

let lineKeySeed = 0

function createLineKey(prefix) {
  lineKeySeed += 1
  return `${prefix}-${lineKeySeed}`
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10)
}

function formatBatchDateStamp(dateValue = getTodayString()) {
  return dateValue.replaceAll('-', '')
}

function createBatchCode(dateValue = getTodayString()) {
  return `PB-${formatBatchDateStamp(dateValue)}-001`
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createPurchaseLine() {
  return {
    key: createLineKey('purchase'),
    materialId: null,
    quantity: '',
    unitCost: '',
    lotCode: ''
  }
}

function createBatchInput() {
  return {
    key: createLineKey('batch'),
    inventoryLotId: null,
    quantity: ''
  }
}

function resetArray(target, nextItems) {
  target.splice(0, target.length, ...nextItems)
}

function asNumber(value, fallback = 0) {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function toIsoTimestamp(dateValue) {
  if (!dateValue) {
    return null
  }

  return `${dateValue}T12:00:00.000Z`
}

function getBatchDateString(value) {
  if (!value) {
    return ''
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return parsedDate.toISOString().slice(0, 10)
}

const $q = useQuasar()
const workspace = ref(getPreviewOperationsWorkspace())
const isLoading = ref(false)
const isSubmittingPurchase = ref(false)
const isSubmittingBatch = ref(false)
const loadError = ref('')
const actionFeedback = ref({
  type: '',
  message: ''
})
const lastSuggestedBatchCode = ref(createBatchCode())

const purchaseForm = reactive({
  supplierId: null,
  purchasedOn: getTodayString(),
  purchaseReference: '',
  notes: '',
  items: [createPurchaseLine()]
})

const batchForm = reactive({
  variantId: null,
  startedOn: getTodayString(),
  batchCode: createBatchCode(),
  outputQuantity: '',
  notes: '',
  inputs: [createBatchInput()]
})

const supplierOptions = computed(() =>
  workspace.value.suppliers.map(supplier => ({
    label: `${supplier.supplier_name} (${formatSupplierKind(supplier.supplier_kind)})`,
    value: supplier.id
  }))
)

const materialOptions = computed(() =>
  workspace.value.materials.map(material => ({
    label: `${material.name} (${material.unit_of_measure})`,
    value: material.id
  }))
)

const variantOptions = computed(() =>
  workspace.value.variants.map(variant => ({
    label: `${variant.sku} / ${variant.variant_name}`,
    value: variant.id
  }))
)

const openInventoryLots = computed(() =>
  (workspace.value.inventoryLots ?? []).filter(
    lot => asNumber(lot.quantity_remaining) > 0
  )
)

const inventoryLotOptions = computed(() =>
  openInventoryLots.value.map(lot => ({
    label: `${lot.lot_code} / ${lot.material?.name ?? 'Material'} / ${formatQuantity(
      lot.quantity_remaining
    )} ${lot.material?.unit_of_measure ?? 'units'} left`,
    value: lot.id
  }))
)

const actionFeedbackClass = computed(() => {
  switch (actionFeedback.value.type) {
    case 'negative':
      return 'bg-negative text-white'

    case 'positive':
      return 'bg-positive text-white'

    default:
      return 'bg-amber-1 text-brown-10'
  }
})

const metrics = computed(() => [
  {
    label: 'Catalogue',
    title: 'Variants ready for production',
    value: `${workspace.value.variants.length}`,
    text: 'Active variants are ready for purchasing, costing, and batch output.'
  },
  {
    label: 'Supply',
    title: 'Materials and suppliers in play',
    value: `${workspace.value.materials.length} materials / ${workspace.value.suppliers.length} suppliers`,
    text: 'Honey, packaging, and supplier masters are ready for entry.'
  },
  {
    label: 'Transactions',
    title: 'Purchases and batches recorded',
    value: `${workspace.value.purchases.length} purchases / ${workspace.value.batches.length} batches`,
    text: 'Receipts create lots, and lots feed completed batches.'
  }
])

const purchaseTotal = computed(() =>
  purchaseForm.items.reduce(
    (total, item) => total + asNumber(item.quantity) * asNumber(item.unitCost),
    0
  )
)

const estimatedBatchInputCost = computed(() =>
  batchForm.inputs.reduce((total, input) => {
    const lot = resolveInventoryLot(input.inventoryLotId)

    if (!lot) {
      return total
    }

    return total + asNumber(input.quantity) * asNumber(lot.unit_cost)
  }, 0)
)

const estimatedBatchUnitCost = computed(() => {
  const outputQuantity = asNumber(batchForm.outputQuantity)

  if (outputQuantity <= 0) {
    return 0
  }

  return estimatedBatchInputCost.value / outputQuantity
})

const purchaseWritesDisabled = computed(() => workspace.value.mode !== 'live')
const batchWritesDisabled = computed(
  () => workspace.value.mode !== 'live' || openInventoryLots.value.length === 0
)

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(asNumber(value))
}

function formatDate(value) {
  if (!value) {
    return 'No date'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(value))
}

function formatQuantity(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 3
  }).format(asNumber(value))
}

function formatMaterialKind(value) {
  return value === 'raw_honey' ? 'Raw honey' : 'Packaging'
}

function formatSupplierKind(value) {
  switch (value) {
    case 'raw_honey':
      return 'Raw honey'

    case 'packaging':
      return 'Packaging'

    default:
      return 'Mixed'
  }
}

function purchaseLabel(purchase) {
  return purchase.purchase_reference?.trim() || `PUR-${purchase.id}`
}

function resolveInventoryLot(lotId) {
  return openInventoryLots.value.find(lot => lot.id === lotId) ?? null
}

function suggestNextBatchCode(dateValue = batchForm.startedOn) {
  const normalizedDateValue = dateValue || getTodayString()
  const batchDateStamp = formatBatchDateStamp(normalizedDateValue)
  const batchCodePattern = new RegExp(
    `^PB-${escapeRegExp(batchDateStamp)}-(\\d{3,})$`
  )

  const nextSequenceNumber =
    (workspace.value.batches ?? []).reduce((highestSequenceNumber, batch) => {
      const batchCode = batch?.batch_code?.trim()

      if (
        !batchCode ||
        getBatchDateString(batch.started_at) !== normalizedDateValue
      ) {
        return highestSequenceNumber
      }

      const codeMatch = batchCode.match(batchCodePattern)

      if (!codeMatch) {
        return highestSequenceNumber
      }

      const parsedSequenceNumber = Number(codeMatch[1])

      if (!Number.isFinite(parsedSequenceNumber)) {
        return highestSequenceNumber
      }

      return Math.max(highestSequenceNumber, parsedSequenceNumber)
    }, 0) + 1

  return `PB-${batchDateStamp}-${String(nextSequenceNumber).padStart(3, '0')}`
}

function syncSuggestedBatchCode({ force = false } = {}) {
  const nextSuggestedBatchCode = suggestNextBatchCode(batchForm.startedOn)

  if (
    force ||
    !batchForm.batchCode?.trim() ||
    batchForm.batchCode === lastSuggestedBatchCode.value
  ) {
    batchForm.batchCode = nextSuggestedBatchCode
  }

  lastSuggestedBatchCode.value = nextSuggestedBatchCode
}

function addPurchaseLine() {
  purchaseForm.items.push(createPurchaseLine())
}

function removePurchaseLine(lineKey) {
  if (purchaseForm.items.length === 1) {
    return
  }

  const nextItems = purchaseForm.items.filter(item => item.key !== lineKey)
  resetArray(purchaseForm.items, nextItems)
}

function addBatchInput() {
  batchForm.inputs.push(createBatchInput())
}

function removeBatchInput(lineKey) {
  if (batchForm.inputs.length === 1) {
    return
  }

  const nextItems = batchForm.inputs.filter(item => item.key !== lineKey)
  resetArray(batchForm.inputs, nextItems)
}

function resetPurchaseForm() {
  purchaseForm.supplierId = null
  purchaseForm.purchasedOn = getTodayString()
  purchaseForm.purchaseReference = ''
  purchaseForm.notes = ''
  resetArray(purchaseForm.items, [createPurchaseLine()])
}

function resetBatchForm() {
  batchForm.variantId = null
  batchForm.startedOn = getTodayString()
  batchForm.batchCode = createBatchCode(batchForm.startedOn)
  batchForm.outputQuantity = ''
  batchForm.notes = ''
  resetArray(batchForm.inputs, [createBatchInput()])
  syncSuggestedBatchCode({ force: true })
}

function clearActionFeedback() {
  actionFeedback.value = {
    type: '',
    message: ''
  }
}

function showMessage(type, message) {
  actionFeedback.value = {
    type,
    message
  }

  if (typeof $q.notify === 'function') {
    $q.notify({
      type,
      message
    })
  }
}

function findDuplicateLotCode(items) {
  const seenLotCodes = new Set()

  for (const item of items) {
    if (typeof item.lot_code !== 'string' || item.lot_code.length === 0) {
      continue
    }

    const normalizedLotCode = item.lot_code.toLowerCase()

    if (seenLotCodes.has(normalizedLotCode)) {
      return item.lot_code
    }

    seenLotCodes.add(normalizedLotCode)
  }

  return null
}

async function loadWorkspace() {
  isLoading.value = true
  loadError.value = ''

  try {
    workspace.value = await fetchOperationsWorkspace()
  } catch (error) {
    workspace.value = getPreviewOperationsWorkspace()
    loadError.value = formatOperationsError(
      error,
      'Unable to load the operations workspace right now.'
    )
  } finally {
    isLoading.value = false
    syncSuggestedBatchCode()
  }
}

async function submitPurchase() {
  if (purchaseWritesDisabled.value) {
    return
  }

  clearActionFeedback()

  const normalizedItems = purchaseForm.items.map(item => ({
    material_id: item.materialId,
    quantity: item.quantity === '' ? Number.NaN : asNumber(item.quantity, NaN),
    unit_cost: item.unitCost === '' ? Number.NaN : asNumber(item.unitCost, NaN),
    lot_code: item.lotCode?.trim() || null
  }))
  const duplicateLotCode = findDuplicateLotCode(normalizedItems)

  if (!purchaseForm.supplierId) {
    showMessage('warning', 'Select a supplier before recording a purchase.')
    return
  }

  if (
    normalizedItems.some(
      item =>
        !item.material_id ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unit_cost) ||
        item.unit_cost < 0
    )
  ) {
    showMessage(
      'warning',
      'Complete every purchase line with a material, quantity, and unit cost.'
    )
    return
  }

  if (duplicateLotCode) {
    showMessage(
      'warning',
      `Lot code "${duplicateLotCode}" is repeated in this receipt. Use unique lot codes or leave them blank to auto-generate.`
    )
    return
  }

  isSubmittingPurchase.value = true

  try {
    await recordPurchase({
      supplierId: purchaseForm.supplierId,
      purchasedAt: toIsoTimestamp(purchaseForm.purchasedOn),
      purchaseReference: purchaseForm.purchaseReference,
      notes: purchaseForm.notes,
      items: normalizedItems
    })

    showMessage(
      'positive',
      'Purchase receipt recorded and inventory lots created.'
    )

    resetPurchaseForm()
    await loadWorkspace()
  } catch (error) {
    showMessage(
      'negative',
      formatOperationsError(error, 'Unable to record the purchase receipt.')
    )
  } finally {
    isSubmittingPurchase.value = false
  }
}

async function submitProductionBatch() {
  if (batchWritesDisabled.value) {
    return
  }

  clearActionFeedback()

  const normalizedInputs = batchForm.inputs.map(input => ({
    inventory_lot_id: input.inventoryLotId,
    quantity: input.quantity === '' ? Number.NaN : asNumber(input.quantity, NaN)
  }))

  const outputQuantity =
    batchForm.outputQuantity === ''
      ? Number.NaN
      : Math.trunc(asNumber(batchForm.outputQuantity, NaN))

  if (!batchForm.variantId) {
    showMessage(
      'warning',
      'Select a finished variant before creating a production batch.'
    )
    return
  }

  if (!batchForm.batchCode?.trim()) {
    showMessage('warning', 'Enter a batch code before saving the batch.')
    return
  }

  if (
    (workspace.value.batches ?? []).some(
      batch =>
        batch.batch_code?.trim()?.toLowerCase() ===
        batchForm.batchCode.trim().toLowerCase()
    )
  ) {
    syncSuggestedBatchCode()
    showMessage(
      'warning',
      `Batch code "${batchForm.batchCode.trim()}" already exists. Try the next suggested code "${lastSuggestedBatchCode.value}".`
    )
    return
  }

  if (!Number.isFinite(outputQuantity) || outputQuantity <= 0) {
    showMessage('warning', 'Enter a valid jar output quantity for the batch.')
    return
  }

  if (
    normalizedInputs.some(
      input =>
        !input.inventory_lot_id ||
        !Number.isFinite(input.quantity) ||
        input.quantity <= 0
    )
  ) {
    showMessage(
      'warning',
      'Every production input needs an open lot and a consumed quantity.'
    )
    return
  }

  const requestedQuantityByLot = new Map()

  for (const input of normalizedInputs) {
    requestedQuantityByLot.set(
      input.inventory_lot_id,
      (requestedQuantityByLot.get(input.inventory_lot_id) ?? 0) + input.quantity
    )
  }

  for (const [inventoryLotId, requestedQuantity] of requestedQuantityByLot) {
    const selectedLot = resolveInventoryLot(inventoryLotId)

    if (!selectedLot) {
      showMessage(
        'warning',
        'One of the selected material lots is no longer open. Refresh the workspace and try again.'
      )
      return
    }

    if (requestedQuantity > asNumber(selectedLot.quantity_remaining)) {
      showMessage(
        'warning',
        `Requested quantity exceeds what remains in lot ${selectedLot.lot_code}. Reduce the consumed quantity before saving the batch.`
      )
      return
    }
  }

  isSubmittingBatch.value = true

  try {
    await recordProductionBatch({
      variantId: batchForm.variantId,
      batchCode: batchForm.batchCode.trim(),
      startedAt: toIsoTimestamp(batchForm.startedOn),
      notes: batchForm.notes,
      outputQuantity,
      inputs: normalizedInputs
    })

    showMessage(
      'positive',
      'Production batch recorded with traceable inputs and output cost.'
    )

    resetBatchForm()
    await loadWorkspace()
  } catch (error) {
    showMessage(
      'negative',
      formatOperationsError(error, 'Unable to create the production batch.')
    )
  } finally {
    isSubmittingBatch.value = false
  }
}

onMounted(() => {
  void loadWorkspace()
})

watch(
  () => batchForm.startedOn,
  () => {
    syncSuggestedBatchCode()
  }
)
</script>
