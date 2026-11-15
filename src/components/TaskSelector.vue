<template>
  <nav class="task-selector" :aria-label="label" data-task-selector>
    <!-- Phone (<600px): every task visible, grouped, no horizontal swipe. -->
    <div class="task-selector__phone lt-sm" @keydown="onPhoneKeydown">
      <div
        v-for="group in groups"
        :key="group.name"
        class="task-selector__group"
      >
        <p :id="`${uid}-${group.name}`" class="task-selector__group-label">{{
          group.label
        }}</p>
        <div
          role="tablist"
          class="task-selector__grid"
          :aria-labelledby="`${uid}-${group.name}`"
        >
          <button
            v-for="item in group.items"
            :key="item.name"
            type="button"
            role="tab"
            class="task-selector__option"
            :class="{ 'task-selector__option--active': item.name === current }"
            :aria-selected="item.name === current ? 'true' : 'false'"
            :data-task="item.name"
            @click="select(item.name)"
          >
            <q-icon
              v-if="item.icon"
              :name="item.icon"
              size="20px"
              aria-hidden="true"
            />
            <span class="task-selector__option-label">{{
              itemLabel(item)
            }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- sm and up: one row of tabs, Do items first. Quasar's lt-sm/gt-xs
         classes hide the inactive variant with display:none, so assistive
         tech only ever sees one set of tabs. -->
    <q-tabs
      class="task-selector__tabs gt-xs"
      :model-value="current"
      align="left"
      inline-label
      outside-arrows
      mobile-arrows
      no-caps
      indicator-color="primary"
      active-color="primary"
      @update:model-value="select"
    >
      <q-tab
        v-for="item in orderedItems"
        :key="item.name"
        :name="item.name"
        :icon="item.icon"
        :label="itemLabel(item)"
        :data-task="item.name"
      />
    </q-tabs>
  </nav>
</template>

<script setup>
import { computed, useId, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps({
  /** `[{ name, label, icon?, group: 'do' | 'review', count? }]` */
  items: { type: Array, required: true },
  /** Selected item name (v-model). */
  modelValue: { type: String, default: '' },
  /** Query parameter that stores the selection. */
  queryKey: { type: String, default: 'view' },
  /** Accessible name of the navigation landmark. */
  label: { type: String, default: 'Tasks' }
})
const emit = defineEmits(['update:modelValue'])
const route = useRoute()
const router = useRouter()
const uid = useId()

const orderedItems = computed(() => [
  ...props.items.filter(item => item.group !== 'review'),
  ...props.items.filter(item => item.group === 'review')
])
const groups = computed(() =>
  [
    {
      name: 'do',
      label: 'Do',
      items: props.items.filter(item => item.group !== 'review')
    },
    {
      name: 'review',
      label: 'Review',
      items: props.items.filter(item => item.group === 'review')
    }
  ].filter(group => group.items.length)
)

const isValid = name => props.items.some(item => item.name === name)
const fallback = () => orderedItems.value[0]?.name ?? ''
const queryValue = () => {
  const value = route.query[props.queryKey]
  return Array.isArray(value) ? value[0] : value
}
const current = computed(() =>
  isValid(props.modelValue) ? props.modelValue : fallback()
)

function itemLabel(item) {
  return item.count === undefined || item.count === null
    ? item.label
    : `${item.label} (${item.count})`
}

function writeQuery(name) {
  if (queryValue() === name) return
  // Keep the URL clean while the default task is shown.
  if (!queryValue() && name === fallback()) return
  router.replace({ query: { ...route.query, [props.queryKey]: name } })
}

function select(name) {
  if (!isValid(name)) return
  if (name !== props.modelValue) emit('update:modelValue', name)
  writeQuery(name)
}

// URL -> model: initial load, reload, back/forward. Invalid -> first item.
watch(
  [queryValue, () => props.items.map(item => item.name).join('|')],
  () => {
    const fromQuery = queryValue()
    const next = isValid(fromQuery)
      ? fromQuery
      : isValid(props.modelValue) && !fromQuery
        ? props.modelValue
        : fallback()
    if (next && next !== props.modelValue) emit('update:modelValue', next)
    if (fromQuery && !isValid(fromQuery) && next) {
      const query = { ...route.query }
      delete query[props.queryKey]
      if (next !== fallback()) query[props.queryKey] = next
      router.replace({ query })
    }
  },
  { immediate: true }
)

// Model -> URL when the page changes the task programmatically.
watch(
  () => props.modelValue,
  name => {
    if (isValid(name)) writeQuery(name)
  }
)

function onPhoneKeydown(event) {
  const keys = [
    'ArrowRight',
    'ArrowDown',
    'ArrowLeft',
    'ArrowUp',
    'Home',
    'End'
  ]
  if (!keys.includes(event.key)) return
  const options = [
    ...event.currentTarget.querySelectorAll('.task-selector__option')
  ]
  const index = options.indexOf(document.activeElement)
  if (index === -1) return
  event.preventDefault()
  let next = index
  if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = options.length - 1
  else if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
    next = (index + 1) % options.length
  else next = (index - 1 + options.length) % options.length
  options[next].focus()
}
</script>

<style scoped>
.task-selector {
  min-width: 0;
}
.task-selector__phone {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-3);
}
.task-selector__group-label {
  margin: 0 0 var(--boms-space-1);
  color: var(--boms-color-text-muted);
  font-size: 0.8125rem;
  font-weight: 700;
}
.task-selector__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 8.5rem), 1fr));
  gap: var(--boms-space-2);
}
.task-selector__option {
  display: flex;
  align-items: center;
  gap: var(--boms-space-2);
  min-height: 44px;
  min-width: 0;
  padding: var(--boms-space-2) var(--boms-space-3);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-sm);
  background: var(--boms-color-surface);
  color: var(--boms-color-text);
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.task-selector__option :deep(.q-icon) {
  flex: 0 0 auto;
  /* Icon ligature text must not widen the grid before the font loads. */
  overflow: hidden;
}
.task-selector__option-label {
  min-width: 0;
  overflow-wrap: anywhere;
}
.task-selector__option--active {
  border-color: var(--boms-color-primary);
  background: var(--boms-color-primary);
  color: var(--boms-color-on-primary);
}
.task-selector__option:focus-visible {
  outline: 3px solid var(--boms-color-focus);
  outline-offset: 2px;
}
.task-selector__tabs :deep(.q-tab) {
  min-height: 48px;
}
.task-selector__tabs :deep(.q-tab__label) {
  font-weight: 700;
}
</style>
