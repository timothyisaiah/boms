<template>
  <section class="metric-strip" :aria-labelledby="headingId">
    <component
      :is="`h${headingLevel}`"
      :id="headingId"
      :class="titleVisible ? 'metric-strip__title' : 'sr-only'"
    >
      {{ title }}
    </component>

    <div v-if="loading" class="metric-strip__grid" aria-hidden="true">
      <div v-for="index in 4" :key="index" class="metric-strip__item">
        <q-skeleton type="text" width="70%" />
        <q-skeleton type="text" width="55%" height="1.75rem" />
        <q-skeleton type="text" width="85%" />
      </div>
    </div>

    <dl v-else class="metric-strip__grid">
      <div v-for="item in items" :key="item.label" class="metric-strip__item">
        <dt class="metric-strip__label">{{ item.label }}</dt>
        <dd class="metric-strip__value tabular-nums">{{ item.value }}</dd>
        <dd v-if="item.hint" class="metric-strip__hint">{{ item.hint }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup>
import { useId } from 'vue'

defineProps({
  /** `[{ label, value, hint? }]` — keep to the few decision figures. */
  items: { type: Array, default: () => [] },
  title: { type: String, required: true },
  /** Visually hidden by default: the page header already names the month. */
  titleVisible: { type: Boolean, default: false },
  headingLevel: { type: Number, default: 2 },
  /** Skeleton tiles while the first load is pending (never zeros). */
  loading: { type: Boolean, default: false }
})

const headingId = useId()
</script>

<style scoped>
.metric-strip {
  min-width: 0;
}
.metric-strip__title {
  margin: 0 0 var(--boms-space-2);
  color: var(--boms-color-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
}
/* One bordered strip; 1px gaps over the border colour draw the dividers. */
.metric-strip__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-border);
}
.metric-strip__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: var(--boms-space-3);
  background: var(--boms-color-surface);
}
.metric-strip__label {
  color: var(--boms-color-text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.3;
}
.metric-strip__value {
  margin: 0;
  color: var(--boms-color-heading);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.metric-strip__hint {
  margin: 0;
  color: var(--boms-color-text-muted);
  font-size: 0.8125rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
</style>
