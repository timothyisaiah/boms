<template>
  <div
    class="workspace-state"
    :class="`workspace-state--${display}`"
    :data-workspace-mode="mode"
  >
    <span
      v-if="display !== 'banner'"
      class="status-chip"
      :class="`status-chip--${tone}`"
      :role="chipRole"
      :aria-live="
        chipRole === 'alert' ? 'assertive' : chipRole ? 'polite' : null
      "
    >
      <q-spinner v-if="busy" size="14px" aria-hidden="true" />
      <q-icon v-else :name="icon" size="16px" aria-hidden="true" />
      <span>{{ label }}</span>
    </span>

    <div
      v-if="showSkeleton"
      class="workspace-state__skeleton"
      aria-hidden="true"
    >
      <q-skeleton type="text" width="60%" />
      <q-skeleton type="rect" height="44px" />
    </div>

    <div
      v-if="showBanner"
      class="workspace-state__banner"
      role="alert"
      aria-live="assertive"
    >
      <q-icon name="cloud_off" size="20px" aria-hidden="true" />
      <div class="workspace-state__message">
        <p class="workspace-state__title">{{ bannerTitle }}</p>
        <p class="workspace-state__detail">{{ bannerDetail }}</p>
      </div>
      <q-btn
        v-if="retryable"
        class="workspace-state__retry"
        outline
        no-caps
        color="primary"
        icon="refresh"
        :label="retryLabel"
        @click="emit('retry')"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { WORKSPACE_MODES } from '@/composables/useWorkspace'

const props = defineProps({
  /** One of WORKSPACE_MODES; normally `useWorkspace().mode`. */
  mode: {
    type: String,
    required: true,
    validator: value => WORKSPACE_MODES.includes(value)
  },
  /** `useWorkspace().error` ({ kind, status, message }). */
  error: { type: Object, default: null },
  /** Timestamp of the last successful load; enables the stale-data note. */
  lastLoadedAt: { type: Number, default: null },
  /** 'full' = chip + banner, 'chip' = chip only, 'banner' = banner only. */
  display: {
    type: String,
    default: 'full',
    validator: value => ['full', 'chip', 'banner'].includes(value)
  },
  /** Show a compact skeleton while the first load is pending. */
  skeleton: { type: Boolean, default: false },
  retryable: { type: Boolean, default: true },
  retryLabel: { type: String, default: 'Retry' }
})
const emit = defineEmits(['retry'])

const labels = {
  loading: 'Loading',
  live: 'Live data',
  refreshing: 'Refreshing',
  unavailable: 'Unavailable'
}
const icons = {
  loading: 'hourglass_empty',
  live: 'check_circle',
  refreshing: 'sync',
  unavailable: 'cloud_off'
}
const tones = {
  loading: 'neutral',
  live: 'success',
  refreshing: 'info',
  unavailable: 'warning'
}

const busy = computed(
  () => props.mode === 'loading' || props.mode === 'refreshing'
)
const label = computed(() => labels[props.mode])
const icon = computed(() => icons[props.mode])
const tone = computed(() => tones[props.mode])
const showBanner = computed(
  () => props.display !== 'chip' && props.mode === 'unavailable'
)
const showSkeleton = computed(() => props.skeleton && props.mode === 'loading')
// Exactly one live region per state: when the banner shows, it alone
// announces (role=alert) and the chip becomes plain text.
const chipRole = computed(() => {
  if (props.mode !== 'unavailable') return 'status'
  return props.display === 'chip' ? 'alert' : null
})
const lastLoadedTime = computed(() =>
  props.lastLoadedAt
    ? new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(
        new Date(props.lastLoadedAt)
      )
    : ''
)
const bannerTitle = computed(() =>
  props.lastLoadedAt
    ? `Data unavailable. Showing data from ${lastLoadedTime.value}.`
    : 'Data unavailable.'
)
const bannerDetail = computed(
  () => props.error?.message || 'This workspace could not be loaded.'
)
</script>

<style scoped>
.workspace-state {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
  min-width: 0;
}
.workspace-state--chip {
  display: inline-flex;
}
.workspace-state__skeleton {
  display: grid;
  gap: var(--boms-space-2);
}
.workspace-state__banner {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--boms-space-2) var(--boms-space-3);
  padding: var(--boms-space-3) var(--boms-space-4);
  border: 1px solid var(--boms-color-warning-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-warning-bg);
  color: var(--boms-color-warning-text);
}
.workspace-state__message {
  flex: 1 1 12rem;
  min-width: 0;
}
.workspace-state__title {
  margin: 0;
  font-weight: 700;
}
.workspace-state__detail {
  margin: var(--boms-space-1) 0 0;
  overflow-wrap: anywhere;
}
.workspace-state__retry {
  flex: 0 0 auto;
}
</style>
