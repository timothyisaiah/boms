<template>
  <q-banner
    v-if="state"
    rounded
    class="q-my-md"
    :class="
      state.status === 'success'
        ? 'bg-green-1 text-green-10'
        : 'bg-amber-1 text-brown-10'
    "
    role="status"
    aria-live="polite"
  >
    <template #avatar
      ><q-spinner v-if="state.status === 'pending'" /><q-icon
        v-else
        :name="
          state.status === 'network'
            ? 'wifi_off'
            : state.status === 'success'
              ? 'check_circle'
              : 'info'
        "
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
async function retry() {
  try {
    const result = await retryWrite(props.action)
    emit('saved', result)
  } catch {
    /* State contains a visible error and keeps the same key. */
  }
}
</script>
