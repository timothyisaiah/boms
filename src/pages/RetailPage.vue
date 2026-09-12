<template>
  <q-page class="page-layout operations-page">
    <section class="page-hero">
      <div>
        <p class="page-hero__eyebrow">Distribution</p>
        <h1 class="page-hero__title">Warehouse and retail stock</h1>
        <p class="page-hero__body">
          Issue batch-traceable stock, track retailer movement, and keep store
          balances visible.
        </p>
      </div>

      <div class="page-hero__actions">
        <AddPartnerButton kind="retailer" @saved="retailerAdded" />
        <PartnerProfiles kind="retailer" @saved="loadWorkspace" />
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
          label="Open reconciliation and finance"
          to="/finance"
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
              {{ openFinishedStock.length }} open batches
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
          <q-tab name="issue-entry" icon="local_shipping" label="Issue stock" />
          <q-tab
            name="movements"
            icon="swap_horiz"
            :label="`Movements (${workspace.retailerMovements.length})`"
          />
          <q-tab
            name="dispatches"
            icon="inventory_2"
            :label="`Dispatches (${workspace.stockIssues.length})`"
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
                <div class="section-label">Warehouse stock</div>
                <div class="section-title"
                  >Finished jars available by batch</div
                >

                <div
                  v-if="openFinishedStock.length > 0"
                  class="list-stack q-mt-lg"
                >
                  <article
                    v-for="stock in openFinishedStock"
                    :key="stock.id"
                    class="list-card"
                  >
                    <div class="detail-row">
                      <strong>{{
                        stock.batch?.batch_code ?? `Batch ${stock.id}`
                      }}</strong>
                      <q-chip square color="green-1" text-color="green-10">
                        {{ formatQuantity(stock.quantity_remaining) }} /
                        {{ formatQuantity(stock.quantity_produced) }} jars left
                      </q-chip>
                    </div>

                    <div class="text-body2 text-grey-8 q-mt-sm">
                      {{ stock.variant?.variant_name ?? 'Unknown variant' }} /
                      {{ stock.variant?.sku ?? 'No SKU' }} /
                      {{ formatMoney(stock.unit_cost) }} per jar
                    </div>

                    <div class="text-caption text-grey-7 q-mt-xs">
                      Produced {{ formatDate(stock.batch?.started_at) }} /
                      {{ stock.variant?.pack_size_grams ?? 'Unknown' }}g /
                      {{ stock.variant?.flavor ?? 'Classic' }}
                    </div>
                  </article>
                </div>

                <div v-else class="empty-state q-mt-lg">
                  No finished stock is open yet. Complete a production batch to
                  start issuing stock.
                </div>
              </div>

              <div class="operations-tab-block">
                <div class="section-label">Retail stock view</div>
                <div class="section-title"
                  >What each partner is currently holding</div
                >

                <div
                  v-if="retailerBalances.length > 0"
                  class="list-stack q-mt-lg"
                >
                  <article
                    v-for="balance in retailerBalances"
                    :key="balance.retailerId"
                    class="list-card"
                  >
                    <div class="detail-row">
                      <strong>{{ balance.retailerName }}</strong>
                      <q-chip
                        square
                        :color="balance.totalUnits > 0 ? 'green-1' : 'grey-2'"
                        :text-color="
                          balance.totalUnits > 0 ? 'green-10' : 'grey-8'
                        "
                      >
                        {{ formatQuantity(balance.totalUnits) }} jars on hand
                      </q-chip>
                    </div>

                    <div class="text-body2 text-grey-8 q-mt-sm">
                      {{
                        balance.deliveryLocation || 'Delivery location pending'
                      }}
                    </div>

                    <div
                      v-if="balance.lines.length > 0"
                      class="summary-pill-row q-mt-sm"
                    >
                      <q-chip
                        v-for="line in balance.lines"
                        :key="line.key"
                        square
                        color="grey-2"
                        text-color="grey-9"
                      >
                        {{ line.variantSku }} / {{ line.batchCode }} /
                        {{ formatQuantity(line.quantity) }} jars
                      </q-chip>
                    </div>

                    <div v-else class="text-caption text-grey-7 q-mt-sm">
                      No open retail stock movements yet.
                    </div>
                  </article>
                </div>

                <div v-else class="empty-state q-mt-lg">
                  Retail balances will appear here after the first stock issue
                  is posted to a partner.
                </div>
              </div>
            </section>
          </q-tab-panel>

          <q-tab-panel name="issue-entry" class="operations-tab-panel">
            <div class="operations-tab-block">
              <div class="section-label">Distribution workflow</div>
              <div class="section-title">Issue stock to retailers</div>

              <div class="text-body2 text-grey-8 q-mt-sm">
                Dispatch traced finished stock to partners without losing batch
                costing context.
              </div>

              <q-banner
                v-if="issueWritesDisabled"
                rounded
                class="bg-grey-2 text-grey-9 q-mt-lg"
              >
                {{ issueWriteMessage }}
              </q-banner>

              <WriteStatus
                action="stock-issues"
                @saved="onSaved(resetIssueForm)"
              />
              <q-form class="q-mt-lg" @submit.prevent="submitStockIssue">
                <div class="inline-form-grid">
                  <q-select
                    v-model="issueForm.retailerId"
                    outlined
                    behavior="dialog"
                    lazy-rules
                    :rules="[required]"
                    emit-value
                    map-options
                    :disable="
                      issueWritesDisabled || retailerOptions.length === 0
                    "
                    :options="retailerOptions"
                    label="Retail partner"
                  />

                  <q-input
                    v-model="issueForm.issuedOn"
                    outlined
                    type="date"
                    lazy-rules
                    :rules="[required]"
                    :disable="issueWritesDisabled"
                    label="Issue date"
                  />

                  <q-input
                    v-model="issueForm.issueReference"
                    outlined
                    :disable="issueWritesDisabled"
                    label="Dispatch reference"
                    hint="Optional delivery note or van sheet"
                  />

                  <q-input
                    v-model="issueForm.notes"
                    outlined
                    type="textarea"
                    autogrow
                    :disable="issueWritesDisabled"
                    label="Notes"
                  />
                </div>

                <div class="operations-subheading q-mt-lg">Issued lines</div>

                <div class="line-item-stack q-mt-sm">
                  <article
                    v-for="(item, index) in issueForm.items"
                    :key="item.key"
                    class="line-item-card"
                  >
                    <div class="detail-row">
                      <strong>Line {{ index + 1 }}</strong>
                      <q-btn
                        v-if="issueForm.items.length > 1"
                        flat
                        round
                        dense
                        type="button"
                        color="negative"
                        icon="delete"
                        aria-label="Remove line"
                        :disable="issueWritesDisabled"
                        @click="removeIssueLine(item.key)"
                      />
                    </div>

                    <div class="line-item-grid line-item-grid--two q-mt-md">
                      <q-select
                        v-model="item.productionOutputId"
                        outlined
                        behavior="dialog"
                        lazy-rules
                        :rules="[required]"
                        emit-value
                        map-options
                        :disable="
                          issueWritesDisabled ||
                          finishedStockOptions.length === 0
                        "
                        :options="finishedStockOptions"
                        label="Finished batch"
                      />

                      <q-input
                        v-model="item.quantity"
                        outlined
                        type="number"
                        inputmode="numeric"
                        lazy-rules
                        :rules="[positive, whole]"
                        min="1"
                        step="1"
                        :disable="issueWritesDisabled"
                        label="Jars issued"
                      />
                    </div>

                    <div
                      v-if="resolveFinishedStock(item.productionOutputId)"
                      class="text-caption text-grey-7 q-mt-sm"
                    >
                      {{
                        resolveFinishedStock(item.productionOutputId).variant
                          ?.variant_name ?? 'Finished stock'
                      }}
                      /
                      {{
                        resolveFinishedStock(item.productionOutputId).batch
                          ?.batch_code ?? 'Batch'
                      }}
                      /
                      {{
                        formatQuantity(
                          resolveFinishedStock(item.productionOutputId)
                            .quantity_remaining
                        )
                      }}
                      jars currently open at
                      {{
                        formatMoney(
                          resolveFinishedStock(item.productionOutputId)
                            .unit_cost
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
                      label="Add line"
                      :disable="issueWritesDisabled"
                      @click="addIssueLine"
                    />

                    <q-chip square color="amber-2" text-color="brown-10">
                      Estimated issue:
                      {{ formatQuantity(estimatedIssueQuantity) }} jars
                    </q-chip>

                    <q-chip square color="blue-1" text-color="blue-10">
                      Estimated stock value:
                      {{ formatMoney(estimatedIssueCost) }}
                    </q-chip>
                  </div>

                  <q-btn
                    color="primary"
                    no-caps
                    type="submit"
                    label="Issue stock"
                    :disable="issueWritesDisabled"
                    :loading="isSubmittingIssue"
                  />
                </div>
              </q-form>
            </div>
          </q-tab-panel>

          <q-tab-panel name="movements" class="operations-tab-panel">
            <div class="operations-tab-block">
              <div class="section-label">Movement history</div>
              <div class="section-title">Recent retailer ledger entries</div>

              <div v-if="movementHistory.length > 0" class="list-stack q-mt-lg">
                <article
                  v-for="movement in movementHistory"
                  :key="movement.id"
                  class="list-card"
                >
                  <div class="detail-row">
                    <strong>{{
                      movement.retailer?.retailer_name ?? 'Retailer'
                    }}</strong>
                    <q-chip square color="amber-2" text-color="brown-10">
                      {{ formatMovementType(movement.movement_type) }}
                    </q-chip>
                  </div>

                  <div class="text-body2 text-grey-8 q-mt-sm">
                    {{ movement.variant?.sku ?? 'Variant' }} /
                    {{ movement.batch?.batch_code ?? 'Batch' }} /
                    {{ formatSignedQuantity(movement.quantity_delta) }} jars
                  </div>

                  <div class="text-caption text-grey-7 q-mt-xs">
                    {{ formatDate(movement.moved_at) }} /
                    {{ formatMoney(movement.unit_cost) }} per jar
                  </div>
                </article>
              </div>

              <div v-else class="empty-state q-mt-lg">
                Retail movement history will start once warehouse stock is
                issued to a partner.
              </div>
            </div>
          </q-tab-panel>

          <q-tab-panel name="dispatches" class="operations-tab-panel">
            <div class="operations-tab-block">
              <div class="section-label">Issue documents</div>
              <div class="section-title">Recent dispatch records</div>

              <div
                v-if="workspace.stockIssues.length > 0"
                class="list-stack q-mt-lg"
              >
                <article
                  v-for="issue in workspace.stockIssues"
                  :key="issue.id"
                  class="list-card"
                >
                  <div class="detail-row">
                    <strong>{{ issueDocumentLabel(issue) }}</strong>
                    <q-chip square color="blue-1" text-color="blue-10">
                      {{ formatQuantity(issue.total_quantity) }} jars
                    </q-chip>
                  </div>

                  <div class="text-body2 text-grey-8 q-mt-sm">
                    {{ issue.retailer?.retailer_name ?? 'Retailer' }} /
                    {{ formatDate(issue.issued_at) }} /
                    {{ formatMoney(issue.total_cost) }}
                  </div>

                  <div class="summary-pill-row q-mt-sm">
                    <q-chip
                      v-for="item in issue.items ?? []"
                      :key="item.id"
                      square
                      color="grey-2"
                      text-color="grey-9"
                    >
                      {{ item.variant?.sku ?? 'Variant' }} /
                      {{ item.batch?.batch_code ?? 'Batch' }} /
                      {{ formatQuantity(item.quantity_issued) }} jars
                    </q-chip>
                  </div>
                </article>
              </div>

              <div v-else class="empty-state q-mt-lg">
                Dispatch records will appear here after the first retailer issue
                is saved.
              </div>
            </div>
          </q-tab-panel>
        </q-tab-panels>
      </q-card>
    </section>
  </q-page>
</template>

<script setup>
import AddPartnerButton from '@/components/AddPartnerButton.vue'
import PartnerProfiles from '@/components/PartnerProfiles.vue'
import WriteStatus from '@/components/WriteStatus.vue'
import { isWriteLocked } from '@/services/writes'
import { required, positive, nonnegative, whole } from '@/lib/validation'
import { computed, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { hasAllowedRole } from '@/constants/roles'
import { authState } from '@/services/auth'
import {
  fetchRetailWorkspace,
  formatRetailError,
  getPreviewRetailWorkspace,
  recordStockIssue
} from '@/services/retail'

let lineKeySeed = 0

function createLineKey(prefix) {
  lineKeySeed += 1
  return `${prefix}-${lineKeySeed}`
}

function getTodayString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

function createIssueLine() {
  return {
    key: createLineKey('issue'),
    productionOutputId: null,
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

const $q = useQuasar()
const workspace = ref(getPreviewRetailWorkspace())
const activeWorkspaceTab = ref('snapshot')
const isLoading = ref(false)
const isSubmittingIssue = ref(false)
const loadError = ref('')

const issueForm = reactive({
  retailerId: null,
  issuedOn: getTodayString(),
  issueReference: '',
  notes: '',
  items: [createIssueLine()]
})

const canIssueStock = computed(() =>
  hasAllowedRole(authState.role, [
    'admin_owner',
    'operations_manager',
    'warehouse_staff',
    'sales_or_distribution_staff'
  ])
)

const openFinishedStock = computed(() =>
  (workspace.value.finishedStock ?? []).filter(
    stock => asNumber(stock.quantity_remaining) > 0
  )
)

const retailerOptions = computed(() =>
  workspace.value.retailers.map(retailer => ({
    label: retailer.delivery_location
      ? `${retailer.retailer_name} / ${retailer.delivery_location}`
      : retailer.retailer_name,
    value: retailer.id
  }))
)

const finishedStockOptions = computed(() =>
  openFinishedStock.value.map(stock => ({
    label: `${stock.batch?.batch_code ?? `Batch ${stock.id}`} / ${stock.variant?.sku ?? 'Variant'} / ${formatQuantity(
      stock.quantity_remaining
    )} jars left`,
    value: stock.id
  }))
)

const estimatedIssueQuantity = computed(() =>
  issueForm.items.reduce(
    (total, item) => total + Math.max(0, Math.trunc(asNumber(item.quantity))),
    0
  )
)

const estimatedIssueCost = computed(() =>
  issueForm.items.reduce((total, item) => {
    const stock = resolveFinishedStock(item.productionOutputId)

    if (!stock) {
      return total
    }

    return (
      total + Math.trunc(asNumber(item.quantity)) * asNumber(stock.unit_cost)
    )
  }, 0)
)

const issueWritesDisabled = computed(
  () =>
    workspace.value.mode !== 'live' ||
    isSubmittingIssue.value ||
    isWriteLocked('stock-issues') ||
    !canIssueStock.value ||
    workspace.value.retailers.length === 0 ||
    openFinishedStock.value.length === 0
)

const issueWriteMessage = computed(() => {
  if (workspace.value.mode !== 'live') {
    return 'Live entry is unavailable. Refresh the workspace to reconnect.'
  }

  if (!canIssueStock.value) {
    return 'Your role can review warehouse and retailer stock, but only warehouse and distribution roles can issue stock.'
  }

  if (workspace.value.retailers.length === 0) {
    return 'Add or seed at least one retailer before issuing stock.'
  }

  if (openFinishedStock.value.length === 0) {
    return 'Finished stock becomes issuable after production batches create open output quantities.'
  }

  return ''
})

const totalOpenUnits = computed(() =>
  openFinishedStock.value.reduce(
    (total, stock) => total + asNumber(stock.quantity_remaining),
    0
  )
)

const movementHistory = computed(() =>
  [...(workspace.value.retailerMovements ?? [])]
    .sort((left, right) => {
      const leftTime = left.moved_at ? new Date(left.moved_at).getTime() : 0
      const rightTime = right.moved_at ? new Date(right.moved_at).getTime() : 0

      return rightTime - leftTime
    })
    .slice(0, 8)
)

const retailerBalances = computed(() => {
  const balancesByRetailer = new Map(
    (workspace.value.retailers ?? []).map(retailer => [
      retailer.id,
      {
        retailerId: retailer.id,
        retailerName: retailer.retailer_name,
        deliveryLocation: retailer.delivery_location,
        totalUnits: 0,
        lines: new Map()
      }
    ])
  )

  for (const movement of workspace.value.retailerMovements ?? []) {
    const retailerId = movement.retailer?.id ?? movement.id
    const currentBalance = balancesByRetailer.get(retailerId) ?? {
      retailerId,
      retailerName: movement.retailer?.retailer_name ?? 'Retailer',
      deliveryLocation: '',
      totalUnits: 0,
      lines: new Map()
    }

    currentBalance.totalUnits += asNumber(movement.quantity_delta)

    const lineKey = [
      movement.variant?.sku ?? 'Variant',
      movement.batch?.batch_code ?? 'Batch'
    ].join('::')
    const currentLine = currentBalance.lines.get(lineKey) ?? {
      key: lineKey,
      variantSku: movement.variant?.sku ?? 'Variant',
      batchCode: movement.batch?.batch_code ?? 'Batch',
      quantity: 0
    }

    currentLine.quantity += asNumber(movement.quantity_delta)
    currentBalance.lines.set(lineKey, currentLine)
    balancesByRetailer.set(retailerId, currentBalance)
  }

  return [...balancesByRetailer.values()]
    .map(balance => ({
      ...balance,
      lines: [...balance.lines.values()]
        .filter(line => line.quantity !== 0)
        .sort((left, right) => right.quantity - left.quantity)
    }))
    .sort((left, right) => {
      if (right.totalUnits !== left.totalUnits) {
        return right.totalUnits - left.totalUnits
      }

      return left.retailerName.localeCompare(right.retailerName)
    })
})

const activeRetailerBalances = computed(
  () => retailerBalances.value.filter(balance => balance.totalUnits > 0).length
)

const metrics = computed(() => [
  {
    label: 'Partners',
    title: 'Retailers ready',
    value: `${workspace.value.retailers.length} listed`,
    text: 'Ready for stock issue.'
  },
  {
    label: 'Warehouse',
    title: 'Open jars',
    value: `${formatQuantity(totalOpenUnits.value)} jars`,
    text: `${openFinishedStock.value.length} batch lines available.`
  },
  {
    label: 'Distribution',
    title: 'Partners with stock',
    value: `${activeRetailerBalances.value}`,
    text: 'Currently holding issued jars.'
  }
])

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
    maximumFractionDigits: 0
  }).format(asNumber(value))
}

function formatSignedQuantity(value) {
  const quantity = asNumber(value)
  const prefix = quantity > 0 ? '+' : ''

  return `${prefix}${formatQuantity(quantity)}`
}

function formatMovementType(value) {
  switch (value) {
    case 'issue':
      return 'Stock issue'

    case 'return_to_warehouse':
      return 'Return to warehouse'

    case 'reconciliation_sale':
      return 'Reconciliation sale'

    case 'damage':
      return 'Damage'

    default:
      return value
        ?.split('_')
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ')
  }
}

function issueDocumentLabel(issue) {
  return issue.issue_reference?.trim() || `ISSUE-${issue.id}`
}

function resolveFinishedStock(productionOutputId) {
  return (
    openFinishedStock.value.find(stock => stock.id === productionOutputId) ??
    null
  )
}

function addIssueLine() {
  issueForm.items.push(createIssueLine())
}

function removeIssueLine(lineKey) {
  if (issueForm.items.length === 1) {
    return
  }

  const nextItems = issueForm.items.filter(item => item.key !== lineKey)
  resetArray(issueForm.items, nextItems)
}

function resetIssueForm() {
  issueForm.retailerId = null
  issueForm.issuedOn = getTodayString()
  issueForm.issueReference = ''
  issueForm.notes = ''
  resetArray(issueForm.items, [createIssueLine()])
}

async function onSaved(resetForm) {
  resetForm()
  await loadWorkspace()
}

async function retailerAdded(result) {
  await loadWorkspace()
  issueForm.retailerId = result.id
}

async function loadWorkspace() {
  isLoading.value = true
  loadError.value = ''

  try {
    workspace.value = await fetchRetailWorkspace()
  } catch (error) {
    workspace.value = getPreviewRetailWorkspace()
    loadError.value = formatRetailError(
      error,
      'Unable to load the warehouse and distribution workspace right now.'
    )
  } finally {
    isLoading.value = false
  }
}

async function submitStockIssue() {
  if (issueWritesDisabled.value) {
    return
  }

  const normalizedItems = issueForm.items.map(item => ({
    production_output_id: item.productionOutputId,
    quantity:
      item.quantity === '' ? Number.NaN : Math.trunc(asNumber(item.quantity))
  }))

  if (!issueForm.retailerId) {
    $q.notify({
      type: 'warning',
      message: 'Select a retailer before issuing stock.'
    })
    return
  }

  if (
    normalizedItems.some(
      item =>
        !item.production_output_id ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0
    )
  ) {
    $q.notify({
      type: 'warning',
      message:
        'Complete every issue line with an open finished batch and a jar quantity.'
    })
    return
  }

  const requestedQuantityByOutput = new Map()

  for (const item of normalizedItems) {
    requestedQuantityByOutput.set(
      item.production_output_id,
      (requestedQuantityByOutput.get(item.production_output_id) ?? 0) +
        item.quantity
    )
  }

  for (const [
    productionOutputId,
    requestedQuantity
  ] of requestedQuantityByOutput) {
    const stock = resolveFinishedStock(productionOutputId)

    if (!stock || requestedQuantity > asNumber(stock.quantity_remaining)) {
      $q.notify({
        type: 'warning',
        message:
          'One of the selected batches no longer has enough open stock for this issue.'
      })
      return
    }
  }

  isSubmittingIssue.value = true

  try {
    await recordStockIssue({
      retailerId: issueForm.retailerId,
      issuedAt: toIsoTimestamp(issueForm.issuedOn),
      issueReference: issueForm.issueReference,
      notes: issueForm.notes,
      items: normalizedItems
    })

    $q.notify({
      type: 'positive',
      message:
        'Stock issue recorded and retailer movement ledger updated successfully.'
    })

    resetIssueForm()
    await loadWorkspace()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: formatRetailError(
        error,
        'Unable to record the stock issue right now.'
      )
    })
  } finally {
    isSubmittingIssue.value = false
  }
}

onMounted(() => {
  void loadWorkspace()
})
</script>
