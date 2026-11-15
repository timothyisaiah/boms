<template>
  <section
    ref="root"
    class="save-confirmation"
    role="status"
    tabindex="-1"
    :aria-labelledby="headingId"
    data-save-confirmation
  >
    <div class="save-confirmation__body">
      <q-icon name="check_circle" size="24px" aria-hidden="true" />
      <div class="save-confirmation__text">
        <component
          :is="`h${headingLevel}`"
          :id="headingId"
          class="save-confirmation__title"
          >{{ title }}</component
        >
        <ul v-if="details.length" class="save-confirmation__details">
          <li v-for="detail in details" :key="detail">{{ detail }}</li>
        </ul>
      </div>
    </div>
    <div class="save-confirmation__actions">
      <slot />
      <q-btn
        flat
        no-caps
        color="primary"
        icon="close"
        label="Dismiss"
        class="save-confirmation__dismiss"
        @click="emit('dismiss')"
      />
    </div>
  </section>
</template>

<script setup>
import { nextTick, onMounted, ref, useId } from 'vue'

defineProps({
  title: { type: String, required: true },
  details: { type: Array, default: () => [] },
  headingLevel: { type: Number, default: 3 }
})
const emit = defineEmits(['dismiss'])
const root = ref(null)
const headingId = useId()

// Bring the outcome into view: on phones the submit button sits in a sticky
// bar far below the top of the form.
onMounted(async () => {
  await nextTick()
  root.value?.focus({ preventScroll: true })
  root.value?.scrollIntoView?.({ block: 'nearest' })
})
</script>

<style scoped>
.save-confirmation {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-3);
  margin-bottom: var(--boms-space-4);
  padding: var(--boms-space-3) var(--boms-space-4);
  border: 1px solid var(--boms-color-success);
  border-left-width: 4px;
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-success-bg);
  color: var(--boms-color-text);
}
.save-confirmation:focus-visible {
  outline: 3px solid var(--boms-color-focus);
  outline-offset: 2px;
}
.save-confirmation__body {
  display: flex;
  align-items: flex-start;
  gap: var(--boms-space-3);
  color: var(--boms-color-success-text);
}
.save-confirmation__body :deep(.q-icon) {
  flex: 0 0 auto;
  overflow: hidden;
}
.save-confirmation__text {
  min-width: 0;
}
.save-confirmation__title {
  margin: 0;
  color: var(--boms-color-success-text);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: normal;
}
.save-confirmation__details {
  margin: var(--boms-space-1) 0 0;
  padding-left: 1.1rem;
  color: var(--boms-color-text);
  overflow-wrap: anywhere;
}
.save-confirmation__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--boms-space-2);
}
.save-confirmation__dismiss {
  margin-left: auto;
}
</style>
