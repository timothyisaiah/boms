<template>
  <section
    class="surface-card dash-panel"
    aria-labelledby="dashboard-trend-title"
  >
    <header class="dash-panel__header">
      <h2 id="dashboard-trend-title" class="section-title dash-panel__title">
        {{ copy.title }}
      </h2>
      <q-btn
        v-if="collapsible"
        flat
        no-caps
        color="primary"
        class="trend__toggle"
        :icon-right="open ? 'expand_less' : 'expand_more'"
        :label="open ? 'Hide trends' : 'Explore monthly trends'"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="bodyId"
        @click="open = !open"
      />
    </header>

    <div v-show="!collapsible || open" :id="bodyId" class="trend__body">
      <div v-if="month" class="trend__focus">
        <h3 class="trend__month">{{ month.label }}</h3>
        <p class="trend__value tabular-nums">{{
          formatTrendValue(mode, month)
        }}</p>
        <p class="trend__summary">
          {{ trendMeta(mode, month) }} ·
          {{ trendComparison(mode, month, previousMonth) }}
        </p>
        <dl class="trend__stats">
          <div v-for="item in focusStats" :key="item.label" class="trend__stat">
            <dt>{{ item.label }}</dt>
            <dd class="tabular-nums">{{ item.value }}</dd>
          </div>
        </dl>
      </div>

      <div class="trend__list" role="group" aria-label="Choose a month">
        <button
          v-for="row in months"
          :key="row.key"
          type="button"
          class="trend-row"
          :class="{ 'trend-row--active': row.key === modelValue }"
          :aria-pressed="row.key === modelValue ? 'true' : 'false'"
          @click="emit('update:modelValue', row.key)"
        >
          <span class="trend-row__label">{{ row.label }}</span>
          <span class="trend-row__value tabular-nums">
            {{ formatTrendValue(mode, row) }}
          </span>
          <span class="trend-row__bar" aria-hidden="true">
            <span
              class="trend-row__fill"
              :style="{ width: `${barWidth(row)}%` }"
            />
          </span>
          <span class="trend-row__hint">{{ trendMeta(mode, row) }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, useId } from 'vue'
import {
  buildTrendFocusStats,
  formatTrendValue,
  getTrendCopy,
  getTrendValue,
  trendComparison,
  trendMeta
} from '@/services/dashboard'

const props = defineProps({
  /** 'sales' | 'issued' | 'output' | 'purchases' (getTrendMode). */
  mode: { type: String, required: true },
  months: { type: Array, default: () => [] },
  snapshot: { type: Object, required: true },
  /** Selected month key (v-model). */
  modelValue: { type: String, default: null },
  /** Phones and tablets start collapsed behind a disclosure button. */
  collapsible: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const bodyId = useId()
const open = ref(false)
const copy = computed(() => getTrendCopy(props.mode))
const monthIndex = computed(() => {
  const index = props.months.findIndex(row => row.key === props.modelValue)
  return index === -1 ? props.months.length - 1 : index
})
const month = computed(() => props.months[monthIndex.value] ?? null)
const previousMonth = computed(() =>
  monthIndex.value > 0 ? props.months[monthIndex.value - 1] : null
)
const focusStats = computed(() =>
  buildTrendFocusStats(props.mode, month.value, props.snapshot)
)
const maxValue = computed(() =>
  Math.max(...props.months.map(row => getTrendValue(props.mode, row)), 0)
)

function barWidth(row) {
  const value = getTrendValue(props.mode, row)
  if (maxValue.value <= 0 || value <= 0) return 0
  return Math.max((value / maxValue.value) * 100, 8)
}
</script>

<style scoped src="./dashboard-panel.css"></style>
<style scoped>
.trend__toggle {
  margin-left: auto;
}
.trend__body {
  display: grid;
  gap: var(--boms-space-4);
  min-width: 0;
}
.trend__focus {
  min-width: 0;
}
.trend__month {
  margin: 0;
  color: var(--boms-color-text-muted);
  font-size: 0.9375rem;
  font-weight: 700;
}
.trend__value {
  margin: var(--boms-space-1) 0 0;
  color: var(--boms-color-heading);
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.trend__summary {
  margin: var(--boms-space-1) 0 0;
  color: var(--boms-color-text-muted);
  font-size: 0.875rem;
  line-height: 1.45;
}
.trend__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 7.5rem), 1fr));
  gap: var(--boms-space-2) var(--boms-space-3);
  margin: var(--boms-space-3) 0 0;
}
.trend__stat {
  min-width: 0;
}
.trend__stat dt {
  color: var(--boms-color-text-muted);
  font-size: 0.8125rem;
}
.trend__stat dd {
  margin: 0;
  color: var(--boms-color-heading);
  font-weight: 700;
  overflow-wrap: anywhere;
}
.trend__list {
  display: grid;
  gap: var(--boms-space-1);
  min-width: 0;
}
.trend-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'label value'
    'bar bar'
    'hint hint';
  gap: var(--boms-space-1) var(--boms-space-2);
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: var(--boms-space-2) var(--boms-space-3);
  border: 1px solid transparent;
  border-radius: var(--boms-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.trend-row:hover {
  background: var(--boms-color-surface-subtle);
}
.trend-row:focus-visible {
  outline: 3px solid var(--boms-color-focus);
  outline-offset: 2px;
}
.trend-row--active {
  border-color: var(--boms-color-primary);
  background: var(--boms-color-surface-subtle);
}
.trend-row__label {
  grid-area: label;
  min-width: 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.trend-row__value {
  grid-area: value;
  font-weight: 700;
  text-align: right;
  overflow-wrap: anywhere;
}
.trend-row__bar {
  grid-area: bar;
  position: relative;
  height: 6px;
  overflow: hidden;
  border-radius: var(--boms-radius-pill);
  background: var(--boms-color-neutral-bg);
}
.trend-row__fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: var(--boms-color-primary);
}
.trend-row__hint {
  grid-area: hint;
  color: var(--boms-color-text-muted);
  font-size: 0.8125rem;
}
@media (min-width: 600px) and (max-width: 1023px) {
  .trend__body {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    align-items: start;
  }
}
</style>
