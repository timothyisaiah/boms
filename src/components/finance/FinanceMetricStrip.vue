<template>
  <dl class="metric-strip" :aria-label="label">
    <div
      v-for="metric in metrics"
      :key="metric.label"
      class="metric-strip__item"
    >
      <dt class="metric-strip__label">{{ metric.label }}</dt>
      <dd class="metric-strip__value">
        <q-skeleton v-if="loading" type="text" width="5rem" />
        <template v-else>{{ metric.value }}</template>
      </dd>
      <dd v-if="metric.text && !loading" class="metric-strip__text">
        {{ metric.text }}
      </dd>
    </div>
  </dl>
</template>

<script setup>
defineProps({
  /** `[{ label, value, text? }]` */
  metrics: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  label: { type: String, default: 'Key figures' }
})
</script>

<style scoped>
.metric-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--boms-space-2);
  margin: 0;
}
.metric-strip__item {
  min-width: 0;
  padding: var(--boms-space-2) var(--boms-space-3);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-sm);
  background: var(--boms-color-surface);
}
.metric-strip__label {
  color: var(--boms-color-text-muted);
  font-size: var(--boms-font-size-caption);
  font-weight: 700;
}
.metric-strip__value {
  margin: 0;
  color: var(--boms-color-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.metric-strip__text {
  display: none;
  margin: 0;
  color: var(--boms-color-text-muted);
  font-size: var(--boms-font-size-caption);
}

@media (min-width: 768px) {
  .metric-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .metric-strip__text {
    display: block;
  }
}
</style>
