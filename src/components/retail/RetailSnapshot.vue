<template>
  <div class="retail-snapshot">
    <section class="retail-snapshot__section" aria-labelledby="snapshot-stock">
      <h2 id="snapshot-stock" class="section-title retail-snapshot__title">
        Finished jars available by batch
      </h2>
      <ul v-if="openFinishedStock.length > 0" class="retail-snapshot__list">
        <li
          v-for="stock in openFinishedStock"
          :key="stock.id"
          class="retail-snapshot__row"
        >
          <div class="retail-snapshot__row-head">
            <strong>{{
              stock.batch?.batch_code ?? `Batch ${stock.id}`
            }}</strong>
            <StatusBadge tone="success" class="tabular-nums">
              {{ formatQuantity(stock.quantity_remaining) }} /
              {{ formatQuantity(stock.quantity_produced) }} jars left
            </StatusBadge>
          </div>
          <p class="retail-snapshot__meta">
            {{ stock.variant?.variant_name ?? 'Unknown variant' }} /
            {{ stock.variant?.sku ?? 'No SKU' }} /
            {{ formatMoney(stock.unit_cost) }} per jar
          </p>
          <p class="retail-snapshot__caption">
            Produced {{ formatDate(stock.batch?.started_at) }} /
            {{ stock.variant?.pack_size_grams ?? 'Unknown' }}g /
            {{ stock.variant?.flavor ?? 'Classic' }}
          </p>
        </li>
      </ul>
      <EmptyState
        v-else-if="ready"
        icon="inventory_2"
        title="No open finished stock"
        message="Complete a production batch to start issuing stock."
      />
      <q-skeleton v-else type="rect" height="72px" />
    </section>

    <section
      class="retail-snapshot__section"
      aria-labelledby="snapshot-balances"
      data-retailer-balances
    >
      <h2 id="snapshot-balances" class="section-title retail-snapshot__title">
        What each partner is currently holding
      </h2>
      <ul v-if="balances.length > 0" class="retail-snapshot__list">
        <li
          v-for="balance in balances"
          :key="balance.retailerId"
          class="retail-snapshot__row"
          :data-retailer-id="balance.retailerId"
        >
          <div class="retail-snapshot__row-head">
            <strong>{{ balance.retailerName }}</strong>
            <StatusBadge
              :tone="balance.totalUnits > 0 ? 'success' : 'neutral'"
              class="tabular-nums"
            >
              {{ formatQuantity(balance.totalUnits) }} jars on hand
            </StatusBadge>
          </div>
          <p class="retail-snapshot__meta">
            {{ balance.deliveryLocation || 'Delivery location pending' }}
          </p>
          <ul v-if="balance.lines.length > 0" class="retail-snapshot__lines">
            <li v-for="line in balance.lines" :key="line.key">
              {{ line.variantSku }} / {{ line.batchCode }} /
              {{ formatQuantity(line.quantity) }} jars
            </li>
          </ul>
          <p v-else class="retail-snapshot__caption">
            No open retail stock movements yet.
          </p>
        </li>
      </ul>
      <EmptyState
        v-else-if="ready"
        icon="storefront"
        title="No retailer balances yet"
        message="Retail balances will appear here after the first stock issue is posted to a partner."
      />
      <q-skeleton v-else type="rect" height="72px" />
    </section>

    <section
      class="retail-snapshot__section retail-snapshot__section--wide"
      aria-labelledby="snapshot-movements"
    >
      <div class="retail-snapshot__header">
        <h2
          id="snapshot-movements"
          class="section-title retail-snapshot__title"
        >
          Recent retailer ledger entries
        </h2>
        <q-btn
          flat
          no-caps
          color="primary"
          icon-right="arrow_forward"
          label="All movements"
          @click="emit('view-movements')"
        />
      </div>
      <div v-if="recentError" class="retail-snapshot__error" role="alert">
        <span>{{ recentError }}</span>
        <q-btn
          outline
          no-caps
          color="primary"
          icon="refresh"
          label="Retry"
          @click="refresh"
        />
      </div>
      <ul v-if="recentMovements.length > 0" class="retail-snapshot__list">
        <li
          v-for="movement in recentMovements"
          :key="movement.id"
          class="retail-snapshot__row"
        >
          <div class="retail-snapshot__row-head">
            <strong>{{
              movement.retailer?.retailer_name ?? 'Retailer'
            }}</strong>
            <StatusBadge :label="formatMovementType(movement.movement_type)" />
          </div>
          <p class="retail-snapshot__meta">
            {{ movement.variant?.sku ?? 'Variant' }} /
            {{ movement.batch?.batch_code ?? 'Batch' }} /
            {{ formatSignedQuantity(movement.quantity_delta) }} jars
          </p>
          <p class="retail-snapshot__caption">
            {{ formatDate(movement.moved_at) }} /
            {{ formatMoney(movement.unit_cost) }} per jar
          </p>
        </li>
      </ul>
      <EmptyState
        v-else-if="recentLoaded && !recentError"
        icon="swap_horiz"
        title="No movements yet"
        message="Retail movement history will start once warehouse stock is issued to a partner."
      />
      <q-skeleton v-else-if="!recentError" type="rect" height="72px" />
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  formatDate,
  formatMoney,
  formatMovementType,
  formatQuantity,
  formatSignedQuantity
} from '@/lib/format'
import { fetchRetailHistoryPage, formatRetailError } from '@/services/retail'

defineProps({
  /** Finished stock with quantity remaining > 0. */
  openFinishedStock: { type: Array, default: () => [] },
  /** mergeRetailerBalances(retailers, retailerStockPositions) */
  balances: { type: Array, default: () => [] },
  /** True once the workspace has loaded at least once. */
  ready: { type: Boolean, default: false }
})
const emit = defineEmits(['view-movements'])

// Latest 8 movements: GET /api/history?resource=retailerMovements&limit=8.
const RECENT_LIMIT = 8
const recentMovements = ref([])
const recentLoaded = ref(false)
const recentError = ref('')
let controller = null

async function refresh() {
  controller?.abort()
  const own = new AbortController()
  controller = own
  try {
    const result = await fetchRetailHistoryPage(
      'retailerMovements',
      { page: 1, rowsPerPage: RECENT_LIMIT, sortBy: null, descending: true },
      {},
      { signal: own.signal }
    )
    if (controller !== own) return
    recentMovements.value = result.rows
    recentError.value = ''
    recentLoaded.value = true
  } catch (error) {
    if (controller !== own || own.signal.aborted) return
    recentError.value = formatRetailError(
      error,
      'Recent movements could not be loaded. Retry in a moment.'
    )
  } finally {
    if (controller === own) controller = null
  }
}

onMounted(refresh)
onBeforeUnmount(() => {
  controller?.abort()
  controller = null
})

defineExpose({ refresh })
</script>

<style scoped>
.retail-snapshot {
  display: grid;
  gap: var(--boms-space-6);
  min-width: 0;
}
.retail-snapshot__section {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-3);
  min-width: 0;
}
.retail-snapshot__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-2);
}
.retail-snapshot__title {
  margin: 0;
}
.retail-snapshot__list {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.retail-snapshot__row {
  min-width: 0;
  padding: var(--boms-space-3) var(--boms-space-4);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface);
}
.retail-snapshot__row-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-2);
  overflow-wrap: anywhere;
}
.retail-snapshot__meta {
  margin: var(--boms-space-2) 0 0;
  color: var(--boms-color-text);
  overflow-wrap: anywhere;
}
.retail-snapshot__caption {
  margin: var(--boms-space-1) 0 0;
  color: var(--boms-color-text-muted);
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}
.retail-snapshot__lines {
  display: flex;
  flex-wrap: wrap;
  gap: var(--boms-space-2);
  margin: var(--boms-space-2) 0 0;
  padding: 0;
  list-style: none;
}
.retail-snapshot__lines li {
  padding: 2px var(--boms-space-2);
  border-radius: var(--boms-radius-sm);
  background: var(--boms-color-neutral-bg);
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}
.retail-snapshot__error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-2);
  padding: var(--boms-space-3);
  border: 1px solid var(--boms-color-warning-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-warning-bg);
  color: var(--boms-color-warning-text);
}

@media (min-width: 1024px) {
  .retail-snapshot {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .retail-snapshot__section--wide {
    grid-column: 1 / -1;
  }
}
</style>
