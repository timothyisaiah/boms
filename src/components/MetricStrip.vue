<template>
  <section
    class="metric-strip"
    :aria-labelledby="headingId"
    :style="columnStyle"
  >
    <component
      :is="`h${headingLevel}`"
      :id="headingId"
      :class="titleVisible ? 'metric-strip__title' : 'sr-only'"
    >
      {{ title }}
    </component>

    <!-- First load: labels when known, never placeholder zero values. -->
    <div
      v-if="loading"
      class="metric-strip__grid"
      aria-hidden="true"
      data-metric-skeleton
    >
      <div
        v-for="index in skeletonTiles"
        :key="index"
        class="metric-strip__item"
      >
        <span v-if="items[index - 1]?.label" class="metric-strip__label">
          {{ items[index - 1].label }}
        </span>
        <q-skeleton v-else type="text" width="70%" />
        <q-skeleton type="text" width="55%" height="1.5rem" />
      </div>
    </div>

    <dl v-else class="metric-strip__grid">
      <div
        v-for="item in orderedItems"
        :key="item.label"
        class="metric-strip__item"
        :class="item.tone && `metric-strip__item--${normalizeTone(item.tone)}`"
      >
        <dt class="metric-strip__label">{{ item.label }}</dt>
        <dd class="metric-strip__value tabular-nums">{{ item.value }}</dd>
        <dd v-if="item.hint" class="metric-strip__hint">{{ item.hint }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup>
import { computed, useId } from 'vue'
import { normalizeTone, sortByException } from '@/lib/status'

const props = defineProps({
  /**
   * `[{ label, value, hint?, tone? }]` — a few decision figures. A `warning`
   * or `danger` tone marks an exception: it moves to the front and keeps its
   * hint on phones. The label must name the figure; tone is never the only cue.
   */
  items: { type: Array, default: () => [] },
  /** Section name; visually hidden unless `titleVisible`. */
  title: { type: String, required: true },
  titleVisible: { type: Boolean, default: false },
  headingLevel: { type: Number, default: 2 },
  /** Skeleton tiles while the first load is pending (never zeros). */
  loading: { type: Boolean, default: false },
  /** Tiles to draw while loading when no items are known yet. */
  skeletonCount: { type: Number, default: 4 }
})

const headingId = useId()
const orderedItems = computed(() => sortByException(props.items))
const skeletonTiles = computed(() => props.items.length || props.skeletonCount)
// Up to three figures share one row even at 320px; four become 2 x 2 on
// phones and one row from 768px.
const columnStyle = computed(() => {
  const count = Math.max(1, skeletonTiles.value)
  return {
    '--metric-strip-columns': count,
    '--metric-strip-phone-columns': count <= 3 ? count : 2
  }
})
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
  grid-template-columns: repeat(
    var(--metric-strip-phone-columns, 2),
    minmax(0, 1fr)
  );
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
  padding: var(--boms-space-2) var(--boms-space-3);
  background: var(--boms-color-surface);
}
.metric-strip__item--warning {
  box-shadow: inset 3px 0 0 var(--boms-color-warning);
}
.metric-strip__item--danger {
  box-shadow: inset 3px 0 0 var(--boms-color-danger);
}
.metric-strip__label {
  color: var(--boms-color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.metric-strip__value {
  margin: 0;
  color: var(--boms-color-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.metric-strip__item--danger .metric-strip__value {
  color: var(--boms-color-danger-text);
}
/* Phones keep only label and figure; exception hints stay visible. */
.metric-strip__hint {
  display: none;
  margin: 0;
  color: var(--boms-color-text-muted);
  font-size: 0.75rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.metric-strip__item--warning .metric-strip__hint,
.metric-strip__item--danger .metric-strip__hint {
  display: block;
}

@media (min-width: 768px) {
  .metric-strip__grid {
    grid-template-columns: repeat(
      var(--metric-strip-columns, 4),
      minmax(0, 1fr)
    );
  }
}
@media (min-width: 600px) {
  .metric-strip__item {
    padding: var(--boms-space-3);
  }
  .metric-strip__label,
  .metric-strip__hint {
    font-size: 0.8125rem;
  }
  .metric-strip__value {
    font-size: 1.25rem;
    line-height: 1.25;
  }
  .metric-strip__hint {
    display: block;
  }
}
</style>
