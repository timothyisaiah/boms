<template>
  <dl class="metric-strip" aria-label="Distribution summary">
    <div
      v-for="metric in metrics"
      :key="metric.label"
      class="metric-strip__item"
    >
      <dt class="metric-strip__label">{{ metric.label }}</dt>
      <dd class="metric-strip__value tabular-nums">
        <q-skeleton v-if="loading" type="text" width="3.5rem" />
        <template v-else>{{ metric.value }}</template>
      </dd>
      <dd v-if="metric.caption && !loading" class="metric-strip__caption">
        {{ metric.caption }}
      </dd>
    </div>
  </dl>
</template>

<script setup>
defineProps({
  /** `[{ label, value, caption? }]` */
  metrics: { type: Array, required: true },
  /** First load pending: show placeholders, never zero values. */
  loading: { type: Boolean, default: false }
})
</script>

<style scoped>
.metric-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--boms-space-2);
  margin: 0;
}
.metric-strip__item {
  min-width: 0;
  padding: var(--boms-space-2) var(--boms-space-3);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface);
}
.metric-strip__label {
  color: var(--boms-color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.metric-strip__value {
  margin: 2px 0 0;
  color: var(--boms-color-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.metric-strip__caption {
  display: none;
  margin: 0;
  color: var(--boms-color-text-muted);
  font-size: 0.75rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

@media (min-width: 600px) {
  .metric-strip__caption {
    display: block;
  }
}
</style>
