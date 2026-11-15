<template>
  <!-- Two root nodes on purpose: the write-status banner scrolls with the
       form while the bar itself sticks (a sticky element only sticks inside
       its parent, so the bar must be a direct child of the form). -->
  <WriteStatus
    v-if="action"
    :action="action"
    @saved="result => emit('saved', result)"
  />
  <div
    v-bind="$attrs"
    class="form-action-bar"
    :class="{ 'form-action-bar--sticky': sticky }"
  >
    <div v-if="$slots.summary" class="form-action-bar__summary">
      <slot name="summary" />
    </div>
    <div class="form-action-bar__row">
      <div v-if="$slots.default" class="form-action-bar__secondary">
        <slot />
      </div>
      <q-btn
        class="form-action-bar__submit"
        color="primary"
        unelevated
        no-caps
        :type="type"
        :label="submitLabel"
        :icon="submitIcon || undefined"
        :loading="loading"
        :disable="disabled || loading"
        @click="onClick"
      />
    </div>
  </div>
</template>

<script setup>
import WriteStatus from '@/components/WriteStatus.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  submitLabel: { type: String, required: true },
  submitIcon: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  /**
   * 'submit' (default): the button submits the enclosing QForm/form; handle
   * the form's @submit. 'button': the bar emits `submit` on click.
   */
  type: {
    type: String,
    default: 'submit',
    validator: value => ['submit', 'button'].includes(value)
  },
  /** writes.js action name; renders WriteStatus (retry/uncertain state). */
  action: { type: String, default: '' },
  /** Sticky to the viewport bottom below md (1024px). */
  sticky: { type: Boolean, default: true }
})
const emit = defineEmits(['submit', 'saved'])

function onClick(event) {
  if (props.type === 'button') emit('submit', event)
}
</script>

<style scoped>
.form-action-bar {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
  margin-top: var(--boms-space-4);
  padding: var(--boms-space-3) 0;
  background: var(--boms-color-surface);
}
.form-action-bar__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--boms-space-2);
  font-variant-numeric: tabular-nums;
}
.form-action-bar__row {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
}
.form-action-bar__secondary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--boms-space-2);
}
.form-action-bar__submit {
  width: 100%;
}

@media (max-width: 1023.98px) {
  .form-action-bar--sticky {
    position: sticky;
    bottom: 0;
    z-index: 2;
    padding-bottom: calc(var(--boms-space-3) + var(--boms-safe-bottom));
    border-top: 1px solid var(--boms-color-border);
    box-shadow: var(--boms-elevation-sticky);
  }
}

@media (min-width: 1024px) {
  .form-action-bar__row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  .form-action-bar__submit {
    width: auto;
    margin-left: auto;
  }
}
</style>
