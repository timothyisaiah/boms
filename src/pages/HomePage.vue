<template>
  <q-page class="page-layout home-page">
    <PageHeader
      title="Home"
      subtitle="Tap what you are doing. The app does the maths."
    >
      <template #status>
        <WorkspaceState display="chip" :mode="ws.mode.value" />
      </template>
    </PageHeader>

    <WorkspaceState
      display="banner"
      :mode="ws.mode.value"
      :error="ws.error.value"
      :last-loaded-at="ws.lastLoadedAt.value"
      @retry="ws.refresh"
    />

    <nav class="home-actions" aria-label="Daily actions">
      <button
        v-for="action in actions"
        :key="action.key"
        type="button"
        class="home-action"
        :class="`home-action--${action.key}`"
        :data-home-action="action.key"
        :disabled="!ws.hasData.value"
        @click="open = action.key"
      >
        <q-icon :name="action.icon" size="36px" class="home-action__icon" />
        <span class="home-action__label">{{ action.label }}</span>
        <span class="home-action__hint">{{ action.hint }}</span>
      </button>
    </nav>

    <section class="home-panel" aria-labelledby="home-jars-title">
      <h2 id="home-jars-title" class="home-panel__title">Jars in store</h2>
      <q-skeleton v-if="!ws.hasData.value" type="rect" height="120px" />
      <template v-else>
        <div v-for="group in jarGroups" :key="group.label" class="home-jars">
          <h3 class="home-jars__flavor">{{ group.label }}</h3>
          <dl class="home-jars__grid">
            <div
              v-for="variant in group.items"
              :key="variant.id"
              class="home-jar"
              :class="{ 'home-jar--low': isLowJar(variant) }"
            >
              <dt class="home-jar__size">{{
                sizeLabel(variant.pack_size_grams)
              }}</dt>
              <dd class="home-jar__count tabular-nums">{{
                inStore[variant.id] ?? 0
              }}</dd>
              <dd v-if="isLowJar(variant)" class="home-jar__flag">Low</dd>
            </div>
          </dl>
        </div>
        <p v-if="!jarGroups.length" class="home-muted"
          >No products set up yet.</p
        >
      </template>
    </section>

    <section
      v-if="data.materialStock.length"
      class="home-panel"
      aria-labelledby="home-supplies-title"
    >
      <h2 id="home-supplies-title" class="home-panel__title">Supplies</h2>
      <ul class="home-supplies">
        <li
          v-for="material in data.materialStock"
          :key="material.id"
          class="home-supply"
          :class="{ 'home-supply--low': isLowMaterial(material) }"
        >
          <span class="home-supply__name">{{ material.name }}</span>
          <span class="home-supply__amount tabular-nums">
            {{ formatMaterialAmount(material, material.on_hand) }}
          </span>
        </li>
      </ul>
    </section>

    <section
      v-if="detailLinks.length"
      class="home-panel"
      aria-labelledby="home-more-title"
    >
      <h2 id="home-more-title" class="home-panel__title">Detailed records</h2>
      <p class="home-muted">
        For corrections, history and reports. Daily work never needs these.
      </p>
      <div class="home-links">
        <q-btn
          v-for="link in detailLinks"
          :key="link.name"
          outline
          no-caps
          color="primary"
          :icon="link.icon"
          :label="link.label"
          :to="link.path"
        />
      </div>
    </section>

    <MakeJarsFlow
      :model-value="open === 'make'"
      :variants="data.variants"
      :recipes="data.recipes"
      :materials="data.materialStock"
      @update:model-value="close"
      @saved="ws.refresh"
    />
    <StockInFlow
      :model-value="open === 'stock-in'"
      :materials="data.materialStock"
      :suppliers="data.suppliers"
      @update:model-value="close"
      @saved="ws.refresh"
    />
    <GiveFlow
      :model-value="open === 'give'"
      :variants="data.variants"
      :retailers="data.retailers"
      :holdings="data.retailerHoldings"
      :in-store="inStore"
      :can-link="canLink"
      @update:model-value="close"
      @saved="ws.refresh"
      @barcode-linked="ws.refresh"
    />
    <SellFlow
      :model-value="open === 'sell'"
      :variants="data.variants"
      :in-store="inStore"
      :can-link="canLink"
      @update:model-value="close"
      @saved="ws.refresh"
      @barcode-linked="ws.refresh"
    />
    <CheckinFlow
      :model-value="open === 'checkin'"
      :variants="data.variants"
      :retailers="data.retailers"
      :holdings="data.retailerHoldings"
      :balances="data.retailerBalances"
      @update:model-value="close"
      @saved="ws.refresh"
    />
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import WorkspaceState from '@/components/WorkspaceState.vue'
import MakeJarsFlow from '@/components/home/MakeJarsFlow.vue'
import StockInFlow from '@/components/home/StockInFlow.vue'
import GiveFlow from '@/components/home/GiveFlow.vue'
import SellFlow from '@/components/home/SellFlow.vue'
import CheckinFlow from '@/components/home/CheckinFlow.vue'
import { useWorkspace } from '@/composables/useWorkspace'
import { can, canWrite } from '@/constants/capabilities'
import { authState } from '@/services/auth'
import {
  emptyHomeWorkspace,
  fetchHomeWorkspace,
  finishedStockMap
} from '@/services/home'
import { formatMaterialAmount, groupVariants, sizeLabel } from '@/lib/simpleOps'

const ws = useWorkspace(({ signal }) => fetchHomeWorkspace({ signal }), {
  initialData: emptyHomeWorkspace()
})
const data = computed(() => ws.data.value ?? emptyHomeWorkspace())
const open = ref('')
const close = value => {
  if (!value) open.value = ''
}

const ALL_ACTIONS = [
  {
    key: 'make',
    action: 'production-run',
    icon: 'science',
    label: 'Make jars',
    hint: 'Filled jars from honey'
  },
  {
    key: 'give',
    action: 'stock-issues',
    icon: 'local_shipping',
    label: 'Give to retailer',
    hint: 'Jars out on consignment'
  },
  {
    key: 'sell',
    action: 'direct-sales',
    icon: 'point_of_sale',
    label: 'Sell',
    hint: 'Customer pays now'
  },
  {
    key: 'checkin',
    action: 'retailer-checkins',
    icon: 'fact_check',
    label: 'Check in retailer',
    hint: 'Count shelf, collect cash'
  },
  {
    key: 'stock-in',
    action: 'purchases',
    icon: 'inventory_2',
    label: 'Stock in',
    hint: 'Honey, jars, labels arrived'
  }
]
const actions = computed(() =>
  ALL_ACTIONS.filter(action => canWrite(authState.role, action.action))
)
const canLink = computed(() => canWrite(authState.role, 'variant-barcode'))

const inStore = computed(() => finishedStockMap(data.value.finishedByVariant))
const jarGroups = computed(() => groupVariants(data.value.variants))
const isLowJar = variant =>
  Number(variant.low_stock_threshold) > 0 &&
  (inStore.value[variant.id] ?? 0) <= Number(variant.low_stock_threshold)
const isLowMaterial = material =>
  Number(material.low_stock_threshold) > 0 &&
  Number(material.on_hand) <= Number(material.low_stock_threshold)

const DETAIL_ROUTES = [
  {
    name: 'operations',
    path: '/operations',
    label: 'Purchases & batches',
    icon: 'warehouse'
  },
  {
    name: 'retail',
    path: '/retail',
    label: 'Distribution',
    icon: 'storefront'
  },
  { name: 'finance', path: '/finance', label: 'Finance', icon: 'payments' },
  {
    name: 'settings',
    path: '/settings',
    label: 'Prices & recipes',
    icon: 'tune'
  }
]
const detailLinks = computed(() =>
  DETAIL_ROUTES.filter(link => can(authState.role, `route:${link.name}`))
)
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-4);
}
.home-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--boms-space-3);
}
@media (min-width: 768px) {
  .home-actions {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
.home-action {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--boms-space-1);
  min-height: 132px;
  padding: var(--boms-space-4);
  text-align: left;
  font: inherit;
  color: var(--boms-color-on-primary);
  background: var(--boms-color-primary);
  border: none;
  border-radius: var(--boms-radius-lg);
  cursor: pointer;
}
.home-action:disabled {
  opacity: 0.6;
  cursor: progress;
}
.home-action:focus-visible {
  outline: 3px solid var(--boms-color-focus);
  outline-offset: 3px;
}
.home-action--give,
.home-action--checkin {
  background: var(--boms-forest);
}
.home-action--sell {
  background: var(--boms-amber);
  color: var(--boms-ink);
}
.home-action--stock-in {
  background: var(--boms-color-surface);
  color: var(--boms-color-heading);
  border: 2px solid var(--boms-color-border-strong);
}
.home-action__label {
  margin-top: auto;
  font-size: 1.125rem;
  font-weight: 800;
  line-height: 1.2;
}
.home-action__hint {
  font-size: var(--boms-font-size-caption);
  opacity: 0.9;
}
.home-panel {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-3);
  padding: var(--boms-space-4);
  background: var(--boms-color-surface);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-lg);
}
.home-panel__title {
  margin: 0;
  font-size: var(--boms-font-size-section-title);
  font-weight: 800;
  color: var(--boms-color-heading);
}
.home-jars {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
}
.home-jars__flavor {
  margin: 0;
  font-size: var(--boms-font-size-label);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--boms-color-text-muted);
}
.home-jars__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--boms-space-2);
  margin: 0;
}
.home-jar {
  padding: var(--boms-space-3);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface-subtle);
  border: 1px solid var(--boms-color-border);
}
.home-jar--low {
  background: var(--boms-color-warning-bg);
  border-color: var(--boms-color-warning-border);
}
.home-jar__size {
  font-size: var(--boms-font-size-label);
  color: var(--boms-color-text-muted);
}
.home-jar__count {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--boms-color-heading);
}
.home-jar__flag {
  margin: 0;
  font-size: var(--boms-font-size-caption);
  font-weight: 800;
  color: var(--boms-color-warning-text);
}
.home-supplies {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.home-supply {
  display: flex;
  justify-content: space-between;
  gap: var(--boms-space-2);
  padding: var(--boms-space-2) 0;
  border-bottom: 1px solid var(--boms-color-border);
}
.home-supply:last-child {
  border-bottom: none;
}
.home-supply--low {
  color: var(--boms-color-warning-text);
  font-weight: 700;
}
.home-supply__name {
  font-weight: 700;
}
.home-muted {
  margin: 0;
  color: var(--boms-color-text-muted);
}
.home-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--boms-space-2);
}
</style>
