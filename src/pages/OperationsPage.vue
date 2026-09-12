<template>
  <q-page class="page-layout operations-page">
    <section class="page-hero">
      <div>
        <p class="page-hero__eyebrow">Operations</p>
        <h1 class="page-hero__title">Supply and production</h1>
        <p class="page-hero__body">
          Receive materials, monitor open lots, and post traceable batches.
        </p>
      </div>

      <div class="page-hero__actions">
        <VariantManager @saved="loadWorkspace" />
        <MaterialManager @saved="loadWorkspace" />
        <AddPartnerButton kind="supplier" @saved="supplierAdded" />
        <PartnerProfiles kind="supplier" @saved="loadWorkspace" />
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
      v-if="workspace.mode !== 'live'"
      rounded
      class="surface-card operations-banner bg-amber-1 text-brown-10"
    >
      Live data is unavailable. Refresh when your connection is restored.
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

    <section class="card-grid card-grid--three operations-page__metrics">
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

    <section>
      <q-card flat class="surface-card operations-workspace-shell">
        <q-card-section class="operations-workspace-shell__header">
          <div>
            <div class="section-label">Workspace</div>
            <div class="section-title">Forms and records</div>
          </div>

          <div class="summary-pill-row">
            <q-chip square color="amber-2" text-color="brown-10">
              {{ openInventoryLots.length }} open lots
            </q-chip>
            <q-chip
              square
              :color="workspace.mode === 'live' ? 'green-1' : 'brown-2'"
              :text-color="workspace.mode === 'live' ? 'green-10' : 'brown-10'"
            >
              {{ workspace.mode === 'live' ? 'Live mode' : 'Preview mode' }}
            </q-chip>
          </div>
        </q-card-section>

        <q-tabs
          v-model="activeWorkspaceTab"
          align="left"
          inline-label
          outside-arrows
          mobile-arrows
          indicator-color="primary"
          active-color="brown-10"
          class="operations-tabs"
        >
          <q-tab name="snapshot" icon="insights" label="Snapshot" />
          <q-tab
            name="purchase-entry"
            icon="receipt_long"
            label="Receipt form"
          />
          <q-tab name="batch-entry" icon="science" label="Batch form" />
          <q-tab
            name="purchases"
            icon="inventory_2"
            :label="`Purchases (${workspace.purchases.length})`"
          />
          <q-tab
            name="batches"
            icon="factory"
            :label="`Batches (${workspace.batches.length})`"
          />
        </q-tabs>

        <q-separator />

        <q-tab-panels
          v-model="activeWorkspaceTab"
          animated
          class="bg-transparent operations-tab-panels"
        >
          <q-tab-panel name="snapshot" class="operations-tab-panel">
            <section class="card-grid card-grid--two">
              <div class="operations-tab-block">
                <div class="section-label">Reference deck</div>
                <div class="section-title"
                  >Variants, materials, and suppliers</div
                >

                <div class="operations-reference-grid q-mt-lg">
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
                        {{ material.name }} /
                        {{ formatMaterialKind(material.kind) }}
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
                </div>
              </div>

              <div class="operations-tab-block">
                <div class="section-label">Open material lots</div>
                <div class="section-title">What production can consume now</div>

                <div
                  v-if="openInventoryLots.length > 0"
                  class="list-stack q-mt-lg"
                >
                  <article
                    v-for="lot in openInventoryLots"
                    :key="lot.id"
                    class="list-card"
                  >
                    <div class="detail-row">
                      <strong>{{
                        lot.material?.name ?? 'Material lot'
                      }}</strong>
                      <q-chip square color="amber-2" text-color="brown-10">
                        {{ lot.lot_code }}
                      </q-chip>
                    </div>

                    <div class="text-body2 text-grey-8 q-mt-sm">
                      {{ formatQuantity(lot.quantity_remaining) }}
                      {{ lot.material?.unit_of_measure ?? 'units' }} left at
                      {{ formatMoney(lot.unit_cost) }} each
                    </div>

                    <div class="text-caption text-grey-7 q-mt-xs">
                      {{ lot.supplier?.supplier_name ?? 'Unknown supplier' }} /
                      received {{ formatDate(lot.received_at) }}
                    </div>
                  </article>
                </div>

                <div v-else class="empty-state q-mt-lg">
                  No open material lots yet. Record a receipt to stock
                  production.
                </div>
              </div>
            </section>
          </q-tab-panel>

          <q-tab-panel name="purchase-entry" class="operations-tab-panel">
            <div class="operations-tab-block">
              <div class="section-label">Purchasing workflow</div>
              <div class="section-title"
                >Receive honey and packaging into lots</div
              >

              <div class="text-body2 text-grey-8 q-mt-sm">
                Post receipts with lot codes so production can consume real
                stock.
              </div>

              <q-banner
                v-if="purchaseWritesDisabled"
                rounded
                class="bg-grey-2 text-grey-9 q-mt-lg"
              >
                Purchase entry is unavailable for this account or connection.
              </q-banner>

              <WriteStatus
                action="purchases"
                @saved="onSaved(resetPurchaseForm)"
              />
              <q-form class="q-mt-lg" @submit.prevent="submitPurchase">
                <div class="inline-form-grid">
                  <q-select
                    v-model="purchaseForm.supplierId"
                    outlined
                    behavior="dialog"
                    lazy-rules
                    :rules="[required]"
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
                    lazy-rules
                    :rules="[required]"
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
                        aria-label="Remove line"
                        :disable="purchaseWritesDisabled"
                        @click="removePurchaseLine(item.key)"
                      />
                    </div>

                    <div class="line-item-grid q-mt-md">
                      <q-select
                        v-model="item.materialId"
                        outlined
                        behavior="dialog"
                        lazy-rules
                        :rules="[required]"
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
                        inputmode="decimal"
                        lazy-rules
                        :rules="[positive]"
                        min="0"
                        step="0.001"
                        :disable="purchaseWritesDisabled"
                        label="Quantity"
                      />

                      <q-input
                        v-model="item.unitCost"
                        outlined
                        type="number"
                        inputmode="decimal"
                        lazy-rules
                        :rules="[nonnegative]"
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
            </div>
          </q-tab-panel>

          <q-tab-panel name="batch-entry" class="operations-tab-panel">
            <div class="operations-tab-block">
              <div class="section-label">Production workflow</div>
              <div class="section-title"
                >Consume lots and create finished output</div
              >

              <div class="text-body2 text-grey-8 q-mt-sm">
                Create a batch from open lots and keep cost per jar traceable.
              </div>

              <q-banner
                v-if="batchWritesDisabled"
                rounded
                class="bg-grey-2 text-grey-9 q-mt-lg"
              >
                Production entry unlocks after live material lots exist. Record
                at least one purchase receipt first.
              </q-banner>

              <WriteStatus
                action="production"
                @saved="onSaved(resetBatchForm)"
              />
              <q-form class="q-mt-lg" @submit.prevent="submitProductionBatch">
                <div class="inline-form-grid">
                  <q-select
                    v-model="batchForm.variantId"
                    outlined
                    behavior="dialog"
                    lazy-rules
                    :rules="[required]"
                    emit-value
                    map-options
                    :disable="
                      batchWritesDisabled || variantOptions.length === 0
                    "
                    :options="variantOptions"
                    label="Finished variant"
                  />

                  <q-input
                    v-model="batchForm.startedOn"
                    outlined
                    type="date"
                    lazy-rules
                    :rules="[required]"
                    :disable="batchWritesDisabled"
                    label="Batch date"
                  />

                  <q-input
                    v-model="batchForm.batchCode"
                    outlined
                    lazy-rules
                    :rules="[required]"
                    :disable="batchWritesDisabled"
                    label="Batch code"
                    hint="Auto-suggested and incremented by date"
                  />

                  <q-input
                    v-model="batchForm.outputQuantity"
                    outlined
                    type="number"
                    inputmode="numeric"
                    lazy-rules
                    :rules="[positive, whole]"
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

                <q-input
                  class="q-mt-md"
                  v-model="batchForm.expiresAt"
                  outlined
                  type="date"
                  label="Batch expiry date"
                  hint="Use the actual batch expiry; leave blank only if not yet known."
                  :disable="batchWritesDisabled"
                />
                <q-banner
                  v-if="matchingRecipe"
                  class="q-mt-md bg-green-1 text-green-10"
                  rounded
                >
                  Recipe: {{ matchingRecipe.name }}. Check and edit the actual
                  quantities below.
                  <template #action
                    ><q-btn
                      no-caps
                      flat
                      label="Apply recipe quantities"
                      :disable="
                        batchWritesDisabled || !Number(batchForm.outputQuantity)
                      "
                      @click="applyRecipe"
                  /></template>
                </q-banner>
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
                        aria-label="Remove line"
                        :disable="batchWritesDisabled"
                        @click="removeBatchInput(input.key)"
                      />
                    </div>

                    <div class="line-item-grid q-mt-md">
                      <q-select
                        v-model="input.inventoryLotId"
                        outlined
                        behavior="dialog"
                        lazy-rules
                        :rules="[required]"
                        emit-value
                        map-options
                        :disable="
                          batchWritesDisabled ||
                          inventoryLotOptions.length === 0
                        "
                        :options="inventoryLotOptions"
                        label="Material lot"
                      />

                      <q-input
                        v-model="input.quantity"
                        outlined
                        type="number"
                        inputmode="decimal"
                        lazy-rules
                        :rules="[positive]"
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
                        resolveInventoryLot(input.inventoryLotId).material
                          ?.name ?? 'Material'
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
                      open at
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
                      Input cost: {{ formatMoney(estimatedBatchInputCost) }}
                    </q-chip>

                    <q-chip square color="blue-1" text-color="blue-10">
                      Cost per jar: {{ formatMoney(estimatedBatchUnitCost) }}
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
            </div>
          </q-tab-panel>

          <q-tab-panel name="purchases" class="operations-tab-panel">
            <div class="operations-tab-block">
              <div class="section-label">Recent purchases</div>
              <div class="section-title">Material receipts now recorded</div>

              <div
                v-if="workspace.purchases.length > 0"
                class="list-stack q-mt-lg"
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
                    {{ purchase.supplier?.supplier_name ?? 'Unknown supplier' }}
                    /
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
              </div>

              <div v-else class="empty-state q-mt-lg">
                Purchases appear here after the first receipt is recorded.
              </div>
            </div>
          </q-tab-panel>

          <q-tab-panel name="batches" class="operations-tab-panel">
            <div class="operations-tab-block">
              <div class="section-label">Recent production batches</div>
              <div class="section-title">Traceable outputs with unit cost</div>

              <div
                v-if="workspace.batches.length > 0"
                class="list-stack q-mt-lg"
              >
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
              </div>

              <div v-else class="empty-state q-mt-lg">
                Batch history starts once a production run consumes real lots.
              </div>
            </div>
          </q-tab-panel>
        </q-tab-panels>
      </q-card>
    </section>
  </q-page>
</template>

<script setup>
import VariantManager from '@/components/VariantManager.vue'
import MaterialManager from '@/components/MaterialManager.vue'
import AddPartnerButton from '@/components/AddPartnerButton.vue'
import PartnerProfiles from '@/components/PartnerProfiles.vue'
import { authState } from '@/services/auth'
import { recipeQuantity } from '@/lib/recipes'
import WriteStatus from '@/components/WriteStatus.vue'
import { isWriteLocked } from '@/services/writes'
import { required, positive, nonnegative, whole } from '@/lib/validation'
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
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
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
const activeWorkspaceTab = ref('snapshot')
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
  expiresAt: '',
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

const inventoryLotOptions = computed(() => [
  ...workspace.value.materials.map(material => ({
    label: `${material.name} / oldest available lots (FIFO)`,
    value: `fifo:${material.id}`
  })),
  ...openInventoryLots.value.map(lot => ({
    label: `${lot.lot_code} / ${lot.material?.name ?? 'Material'} / ${formatQuantity(
      lot.quantity_remaining
    )} ${lot.material?.unit_of_measure ?? 'units'} left`,
    value: lot.id
  }))
])

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
    title: 'Active variants',
    value: `${workspace.value.variants.length} ready`,
    text: 'Ready for purchasing and batch output.'
  },
  {
    label: 'Supply',
    title: 'Materials / suppliers',
    value: `${workspace.value.materials.length} / ${workspace.value.suppliers.length}`,
    text: 'Stock sources ready for entry.'
  },
  {
    label: 'Transactions',
    title: 'Receipts / batches',
    value: `${workspace.value.purchases.length} / ${workspace.value.batches.length}`,
    text: 'Recorded in this workspace.'
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

const purchaseWritesDisabled = computed(
  () =>
    workspace.value.mode !== 'live' ||
    isSubmittingPurchase.value ||
    isWriteLocked('purchases') ||
    !['admin_owner', 'operations_manager', 'warehouse_staff'].includes(
      authState.role
    )
)
const batchWritesDisabled = computed(
  () =>
    workspace.value.mode !== 'live' ||
    isSubmittingBatch.value ||
    isWriteLocked('production') ||
    !['admin_owner', 'operations_manager', 'production_staff'].includes(
      authState.role
    ) ||
    openInventoryLots.value.length === 0
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
  switch (value) {
    case 'raw_honey':
      return 'Raw honey'

    case 'spice':
      return 'Spice'

    default:
      return 'Packaging'
  }
}

function formatSupplierKind(value) {
  switch (value) {
    case 'raw_honey':
      return 'Raw honey'

    case 'packaging':
      return 'Packaging'

    case 'spice':
      return 'Spice'

    default:
      return 'Mixed'
  }
}

function purchaseLabel(purchase) {
  return purchase.purchase_reference?.trim() || `PUR-${purchase.id}`
}

function resolveInventoryLot(lotId) {
  return (
    openInventoryLots.value.find(lot =>
      String(lotId).startsWith('fifo:')
        ? String(lot.material?.id) === String(lotId).slice(5)
        : lot.id === lotId
    ) ?? null
  )
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
  batchForm.expiresAt = ''
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

async function onSaved(resetForm) {
  resetForm()
  await loadWorkspace()
}

async function supplierAdded(result) {
  await loadWorkspace()
  purchaseForm.supplierId = result.id
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
    inventory_lot_id: String(input.inventoryLotId).startsWith('fifo:')
      ? null
      : input.inventoryLotId,
    material_id: String(input.inventoryLotId).startsWith('fifo:')
      ? Number(String(input.inventoryLotId).slice(5))
      : null,
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
        (!input.inventory_lot_id && !input.material_id) ||
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
    if (!input.inventory_lot_id) continue
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
      expiresAt: batchForm.expiresAt || null,
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

const matchingRecipe = computed(() =>
  (workspace.value.recipes ?? []).find(
    recipe => recipe.variant_id === batchForm.variantId
  )
)
let lastRecipeDefaults = ''
function applyRecipe() {
  if (!matchingRecipe.value || !Number(batchForm.outputQuantity)) return
  resetArray(
    batchForm.inputs,
    matchingRecipe.value.items.map(item => ({
      key: createLineKey('batch'),
      inventoryLotId: 'fifo:' + item.material_id,
      quantity: recipeQuantity(item.quantity_per_unit, batchForm.outputQuantity)
    }))
  )
  lastRecipeDefaults = JSON.stringify(batchForm.inputs)
}
watch(
  () => [batchForm.variantId, batchForm.outputQuantity],
  () => {
    if (
      batchForm.inputs.every(input => input.quantity === '') ||
      JSON.stringify(batchForm.inputs) === lastRecipeDefaults
    )
      applyRecipe()
  }
)

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
