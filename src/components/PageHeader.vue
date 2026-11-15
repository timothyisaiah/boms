<template>
  <header class="page-header">
    <div class="page-header__heading">
      <h1 class="page-header__title">{{ title }}</h1>
      <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
    </div>

    <div v-if="$slots.status" class="page-header__status">
      <slot name="status" />
    </div>

    <div v-if="hasActions" class="page-header__actions">
      <slot name="primary" />
      <q-btn
        v-if="hasOverflow"
        class="page-header__overflow"
        flat
        round
        color="primary"
        icon="more_vert"
        :aria-label="overflowLabel"
        :title="overflowLabel"
      >
        <q-menu anchor="bottom right" self="top right">
          <q-list class="page-header__menu">
            <q-item
              v-for="item in visibleActions"
              :key="item.label"
              v-close-popup
              clickable
              :to="item.to"
              :disable="item.disable"
              @click="run(item)"
            >
              <q-item-section v-if="item.icon" avatar>
                <q-icon :name="item.icon" aria-hidden="true" />
              </q-item-section>
              <q-item-section>{{ item.label }}</q-item-section>
            </q-item>
            <slot name="overflow" />
          </q-list>
        </q-menu>
      </q-btn>
    </div>
  </header>
</template>

<script setup>
import { computed, useSlots } from 'vue'

const props = defineProps({
  /** Route title; rendered as the page's only h1. */
  title: { type: String, required: true },
  /** Optional one-line context. Do not restate the title. */
  subtitle: { type: String, default: '' },
  /**
   * Secondary/management actions shown in the overflow menu:
   * `{ label, icon?, to?, handler?, visible? = true, disable? }`.
   */
  actions: { type: Array, default: () => [] },
  /** Accessible name of the overflow button. */
  overflowLabel: { type: String, default: 'More actions' }
})

const slots = useSlots()
const visibleActions = computed(() =>
  props.actions.filter(action => action.visible !== false)
)
const hasOverflow = computed(
  () => visibleActions.value.length > 0 || Boolean(slots.overflow)
)
const hasActions = computed(() => hasOverflow.value || Boolean(slots.primary))

function run(item) {
  if (!item.disable) item.handler?.()
}
</script>

<style scoped>
.page-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'heading status'
    'actions actions';
  align-items: center;
  gap: var(--boms-space-2) var(--boms-space-3);
  padding-bottom: var(--boms-space-3);
  border-bottom: 1px solid var(--boms-color-border);
}
.page-header__heading {
  grid-area: heading;
  min-width: 0;
}
.page-header__title {
  margin: 0;
  color: var(--boms-color-heading);
  font-size: var(--boms-font-size-page-title);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: normal;
  overflow-wrap: anywhere;
}
.page-header__subtitle {
  margin: var(--boms-space-1) 0 0;
  color: var(--boms-color-text-muted);
  font-size: 0.9375rem;
  line-height: 1.45;
}
.page-header__status {
  grid-area: status;
  justify-self: end;
  min-width: 0;
}
.page-header__actions {
  grid-area: actions;
  display: flex;
  align-items: center;
  gap: var(--boms-space-2);
  min-width: 0;
}
.page-header__actions > :deep(.q-btn:not(.page-header__overflow)) {
  flex: 1 1 auto;
}
.page-header__overflow {
  flex: 0 0 auto;
  margin-left: auto;
  /* Icon ligature text must never widen the page before the font loads. */
  overflow: hidden;
}
.page-header__menu {
  min-width: 14rem;
}
.page-header__menu :deep(.q-item) {
  min-height: 48px;
}

@media (min-width: 600px) {
  .page-header {
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-areas: 'heading status actions';
  }
  .page-header__actions > :deep(.q-btn:not(.page-header__overflow)) {
    flex: 0 0 auto;
  }
}
</style>
