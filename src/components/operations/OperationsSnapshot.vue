<template>
  <div class="ops-snapshot">
    <section aria-labelledby="ops-lots-title">
      <h2 id="ops-lots-title" class="section-title ops-snapshot__title"
        >Open material lots</h2
      >
      <p class="ops-snapshot__intro">What production can consume now.</p>

      <ul v-if="openLots.length > 0" class="ops-snapshot__lots">
        <li v-for="lot in openLots" :key="lot.id" class="list-card">
          <div class="detail-row">
            <strong>{{ lot.material?.name ?? 'Material lot' }}</strong>
            <span class="status-chip status-chip--neutral">{{
              lot.lot_code
            }}</span>
          </div>
          <p class="ops-snapshot__line">
            {{ formatQuantity(lot.quantity_remaining, 3) }}
            {{ lot.material?.unit_of_measure ?? 'units' }} left at
            {{ formatMoney(lot.unit_cost) }} each
          </p>
          <p class="ops-snapshot__meta">
            {{ lot.supplier?.supplier_name ?? 'Unknown supplier' }} / received
            {{ formatDate(lot.received_at) }}
          </p>
        </li>
      </ul>

      <EmptyState
        v-else
        class="q-mt-md"
        title="No open material lots"
        message="Record a receipt to stock production."
      />
    </section>

    <section aria-labelledby="ops-reference-title">
      <h2 id="ops-reference-title" class="section-title ops-snapshot__title"
        >Variants, materials, and suppliers</h2
      >

      <h3 class="ops-snapshot__subheading">Product variants</h3>
      <ul class="ops-snapshot__chips">
        <li
          v-for="variant in workspace.variants ?? []"
          :key="variant.id"
          class="status-chip status-chip--neutral"
        >
          {{ variant.sku }} / {{ variant.variant_name }}
        </li>
      </ul>

      <h3 class="ops-snapshot__subheading">Material catalogue</h3>
      <ul class="ops-snapshot__chips">
        <li
          v-for="material in workspace.materials ?? []"
          :key="material.id"
          class="status-chip status-chip--success"
        >
          {{ material.name }} / {{ formatMaterialKind(material.kind) }}
        </li>
      </ul>

      <h3 class="ops-snapshot__subheading">Supplier pool</h3>
      <ul class="ops-snapshot__chips">
        <li
          v-for="supplier in workspace.suppliers ?? []"
          :key="supplier.id"
          class="status-chip status-chip--info"
        >
          {{ supplier.supplier_name }}
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import EmptyState from '@/components/EmptyState.vue'
import {
  formatDate,
  formatMaterialKind,
  formatMoney,
  formatQuantity
} from '@/lib/format'

defineProps({
  /** Operations summary (variants, materials, suppliers). */
  workspace: { type: Object, required: true },
  openLots: { type: Array, default: () => [] }
})
</script>

<style scoped>
.ops-snapshot {
  display: grid;
  gap: var(--boms-space-6);
}
@media (min-width: 1024px) {
  .ops-snapshot {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.ops-snapshot__title {
  margin: 0;
}
.ops-snapshot__intro {
  margin: var(--boms-space-1) 0 0;
  color: var(--boms-color-text-muted);
}
.ops-snapshot__lots {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-3);
  margin: var(--boms-space-3) 0 0;
  padding: 0;
  list-style: none;
}
.ops-snapshot__line {
  margin: var(--boms-space-2) 0 0;
}
.ops-snapshot__meta {
  margin: var(--boms-space-1) 0 0;
  color: var(--boms-color-text-muted);
  font-size: var(--boms-font-size-caption);
}
.ops-snapshot__subheading {
  margin: var(--boms-space-4) 0 var(--boms-space-2);
  color: var(--boms-color-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: normal;
}
.ops-snapshot__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--boms-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ops-snapshot__chips .status-chip {
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
