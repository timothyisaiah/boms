<template>
  <!--
    One outcome contract for every idempotent write (MF-10):
    - pending / success → role="status" (polite, announced once);
    - validation / network / expired → role="alert" (needs attention).
    Keyed by status so each new outcome is a fresh live region and is announced
    exactly once instead of relying on an attribute change.
  -->
  <q-banner
    v-if="state"
    :key="state.status"
    rounded
    class="write-status q-my-md"
    :class="`write-status--${tone}`"
    :role="isProblem ? 'alert' : 'status'"
    :aria-live="isProblem ? null : 'polite'"
    :data-write-status="state.status"
  >
    <template #avatar
      ><q-spinner v-if="state.status === 'pending'" aria-hidden="true" /><q-icon
        v-else
        aria-hidden="true"
        :name="icon"
    /></template>
    {{ state.message }}
    <div v-if="state.status === 'expired'" class="text-caption"
      >Reference: {{ state.key }}</div
    >
    <template v-if="state.status === 'network'" #action
      ><q-btn
        no-caps
        color="primary"
        label="Retry saved submission"
        @click="retry"
    /></template>
  </q-banner>
</template>
<script setup>
import { computed } from 'vue'
import { writeStates, retryWrite } from '@/services/writes'
const props = defineProps({ action: { type: String, required: true } })
const emit = defineEmits(['saved'])
const state = computed(() => writeStates[props.action])
const isProblem = computed(() =>
  ['validation', 'network', 'expired'].includes(state.value?.status)
)
const tone = computed(
  () =>
    ({
      success: 'success',
      pending: 'info',
      validation: 'danger'
    })[state.value?.status] ?? 'warning'
)
const icon = computed(
  () =>
    ({
      network: 'wifi_off',
      success: 'check_circle',
      validation: 'error',
      expired: 'history'
    })[state.value?.status] ?? 'info'
)
async function retry() {
  try {
    const result = await retryWrite(props.action)
    emit('saved', result)
  } catch {
    /* State contains a visible error and keeps the same key. */
  }
}
</script>
<style scoped>
.write-status--success {
  background: var(--boms-color-success-bg);
  color: var(--boms-color-success-text);
}
.write-status--info {
  background: var(--boms-color-info-bg);
  color: var(--boms-color-info-text);
}
.write-status--warning {
  background: var(--boms-color-warning-bg);
  color: var(--boms-color-warning-text);
}
.write-status--danger {
  background: var(--boms-color-danger-bg);
  color: var(--boms-color-danger-text);
}
</style>
