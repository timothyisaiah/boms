<template>
  <section
    class="surface-card dash-panel attention"
    aria-labelledby="attention-title"
  >
    <header class="dash-panel__header">
      <h2 id="attention-title" class="section-title dash-panel__title">
        What needs attention now
      </h2>
      <p class="dash-panel__intro">
        Collections, in-store stock and open lots to act on.
      </p>
    </header>

    <div class="attention__groups">
      <section
        v-if="showRetailers"
        class="attention__group"
        aria-labelledby="attention-retailers"
      >
        <h3 id="attention-retailers" class="attention__group-title">
          Collections and in-store stock
        </h3>
        <ul v-if="retailerWatchlist.length > 0" class="dash-rows" role="list">
          <li v-for="item in retailerWatchlist" :key="item.id" class="dash-row">
            <div class="dash-row__main">
              <span class="dash-row__title">{{ item.title }}</span>
              <span class="dash-row__detail">{{ item.subtitle }}</span>
              <span class="dash-row__meta">
                {{ formatMoney(item.recognizedSalesValue) }} recognized /
                {{ formatMoney(item.remittedAmount) }} remitted
              </span>
            </div>
            <div class="dash-row__end">
              <span
                class="status-chip"
                :class="`status-chip--${item.statusTone}`"
              >
                {{ item.statusLabel }}
              </span>
              <span class="dash-row__value tabular-nums">
                {{
                  item.outstandingAmount > 0
                    ? formatMoney(item.outstandingAmount)
                    : `${formatQuantity(item.remainingQuantity)} jars`
                }}
              </span>
            </div>
          </li>
        </ul>
        <p v-else class="attention__empty">
          No retailer has an open balance or stock in store.
        </p>
      </section>

      <section
        v-for="section in stockSections"
        :key="section.key"
        class="attention__group"
        :aria-labelledby="`attention-${section.key}`"
      >
        <h3 :id="`attention-${section.key}`" class="attention__group-title">
          {{ section.title }}
        </h3>
        <ul class="dash-rows" role="list">
          <li
            v-for="item in section.items"
            :key="`${section.key}-${item.id}`"
            class="dash-row"
          >
            <div class="dash-row__main">
              <span class="dash-row__title">{{ item.title }}</span>
              <span class="dash-row__detail">{{ item.detail }}</span>
              <span class="dash-row__meta">{{ item.meta }}</span>
            </div>
            <div class="dash-row__end">
              <span class="dash-row__value tabular-nums">
                {{ formatQuantity(item.value) }} {{ item.unit }}
              </span>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <EmptyState
      v-if="!showRetailers && stockSections.length === 0"
      icon="task_alt"
      title="Nothing to review"
      message="No stock or retailer watch items are available for your current access."
    />
  </section>
</template>

<script setup>
import EmptyState from '@/components/EmptyState.vue'
import { formatMoney, formatQuantity } from '@/lib/format'

defineProps({
  retailerWatchlist: { type: Array, default: () => [] },
  stockSections: { type: Array, default: () => [] },
  /** Retailer balances are a REVIEW projection; other roles never get them. */
  showRetailers: { type: Boolean, default: false }
})
</script>

<style scoped src="./dashboard-panel.css"></style>
<style scoped>
.attention__groups {
  display: grid;
  gap: var(--boms-space-4);
}
.attention__group {
  min-width: 0;
}
.attention__group-title {
  margin: 0 0 var(--boms-space-2);
  color: var(--boms-color-heading);
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.35;
}
.attention__empty {
  margin: 0;
  color: var(--boms-color-text-muted);
}
@media (min-width: 1440px) {
  .attention__groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
