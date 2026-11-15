<template>
  <section
    class="surface-card dash-panel"
    aria-labelledby="dashboard-review-title"
  >
    <header class="dash-panel__header">
      <h2 id="dashboard-review-title" class="section-title dash-panel__title">
        Monthly review{{ month ? `: ${month.label}` : '' }}
      </h2>
    </header>

    <div class="review__picker" role="group" aria-label="Review month">
      <q-btn
        v-for="row in months"
        :key="row.key"
        no-caps
        unelevated
        :outline="row.key !== month?.key"
        color="primary"
        :label="row.label"
        :aria-pressed="row.key === month?.key ? 'true' : 'false'"
        @click="emit('update:modelValue', row.key)"
      />
    </div>

    <template v-if="hasData">
      <DashboardMetricStrip
        title="Review summary"
        title-visible
        :heading-level="3"
        :items="stats"
      />

      <div class="review__columns">
        <section aria-labelledby="dashboard-review-notes">
          <h3 id="dashboard-review-notes" class="review__subtitle">
            What stands out in the month
          </h3>
          <ul class="dash-rows" role="list">
            <li
              v-for="note in notes"
              :key="note.title"
              class="dash-row review__note"
            >
              <span class="status-chip" :class="`status-chip--${note.tone}`">
                {{ note.title }}
              </span>
              <span class="review__note-text">{{ note.text }}</span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="dashboard-review-lines">
          <h3 id="dashboard-review-lines" class="review__subtitle">
            Core review lines
          </h3>
          <dl class="review__lines">
            <div v-for="row in breakdown" :key="row.label" class="review__line">
              <dt>{{ row.label }}</dt>
              <dd class="tabular-nums">{{ row.value }}</dd>
            </div>
          </dl>
        </section>
      </div>
    </template>
    <DashboardMetricStrip
      v-else-if="loading"
      title="Review summary"
      :heading-level="3"
      loading
    />
  </section>
</template>

<script setup>
import { computed } from 'vue'
import DashboardMetricStrip from './DashboardMetricStrip.vue'
import {
  buildMonthlyBreakdown,
  buildMonthlyNotes,
  buildMonthlyReviewStats
} from '@/services/dashboard'

const props = defineProps({
  access: { type: Object, required: true },
  months: { type: Array, default: () => [] },
  /** Selected month key (v-model). */
  modelValue: { type: String, default: null },
  /** False until the workspace has loaded once; figures stay hidden. */
  hasData: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const month = computed(
  () =>
    props.months.find(row => row.key === props.modelValue) ??
    props.months[props.months.length - 1] ??
    null
)
const stats = computed(() => buildMonthlyReviewStats(props.access, month.value))
const notes = computed(() => buildMonthlyNotes(props.access, month.value))
const breakdown = computed(() =>
  buildMonthlyBreakdown(props.access, month.value)
)
</script>

<style scoped src="./dashboard-panel.css"></style>
<style scoped>
.review__picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--boms-space-2);
}
.review__picker > .q-btn {
  flex: 1 1 6.5rem;
}
.review__columns {
  display: grid;
  gap: var(--boms-space-4);
}
.review__subtitle {
  margin: 0 0 var(--boms-space-2);
  color: var(--boms-color-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
}
.review__note {
  flex-direction: column;
  align-items: flex-start;
}
.review__note-text {
  line-height: 1.5;
}
.review__lines {
  display: grid;
  margin: 0;
}
.review__line {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--boms-space-1) var(--boms-space-3);
  padding: var(--boms-space-2) 0;
  border-top: 1px solid var(--boms-color-border);
}
.review__line:first-child {
  border-top: 0;
  padding-top: 0;
}
.review__line dt {
  color: var(--boms-color-text);
}
.review__line dd {
  margin: 0;
  color: var(--boms-color-heading);
  font-weight: 700;
  overflow-wrap: anywhere;
}
@media (min-width: 1024px) {
  .review__columns {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
