<template>
  <q-dialog
    :model-value="prompt.open"
    persistent
    @update:model-value="open => !open && cancel()"
  >
    <q-card class="dirty-guard" role="alertdialog" :aria-labelledby="titleId">
      <q-card-section>
        <h2 :id="titleId" class="dirty-guard__title">{{ title }}</h2>
        <p class="dirty-guard__message">{{ message }}</p>
      </q-card-section>
      <q-card-actions align="right" class="dirty-guard__actions">
        <q-btn
          flat
          no-caps
          color="primary"
          :label="stayLabel"
          autofocus
          @click="cancel"
        />
        <q-btn
          unelevated
          no-caps
          color="primary"
          :label="leaveLabel"
          @click="confirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useId } from 'vue'
import { useDirtyGuard } from '@/composables/useDirtyGuard'

const props = defineProps({
  /** Guard is active while true (e.g. `draft.isDirty.value`). */
  when: { type: Boolean, default: false },
  title: { type: String, default: 'Leave this form?' },
  message: {
    type: String,
    default:
      'Your entries are kept as a draft on this device until you sign out.'
  },
  stayLabel: { type: String, default: 'Stay on form' },
  leaveLabel: { type: String, default: 'Leave' }
})

const titleId = useId()
const { prompt, confirm, cancel } = useDirtyGuard(() => props.when)
</script>

<style scoped>
.dirty-guard {
  width: min(28rem, calc(100vw - 2 * var(--boms-space-4)));
  border-radius: var(--boms-radius-lg);
  box-shadow: var(--boms-elevation-overlay);
}
.dirty-guard__title {
  margin: 0;
  color: var(--boms-color-heading);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: normal;
}
.dirty-guard__message {
  margin: var(--boms-space-2) 0 0;
  line-height: 1.5;
}
.dirty-guard__actions {
  flex-wrap: wrap;
  gap: var(--boms-space-2);
  padding: var(--boms-space-3) var(--boms-space-4) var(--boms-space-4);
}
</style>
