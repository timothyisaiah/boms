<template>
  <div class="empty-state boms-empty-state">
    <q-icon
      v-if="icon"
      class="boms-empty-state__icon"
      :name="icon"
      size="24px"
      aria-hidden="true"
    />
    <div class="boms-empty-state__body">
      <p v-if="title" class="boms-empty-state__title">{{ title }}</p>
      <p v-if="message || $slots.default" class="boms-empty-state__message">
        <slot>{{ message }}</slot>
      </p>
      <div v-if="$slots.actions" class="boms-empty-state__actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  /** Short reason, e.g. "No purchases yet". */
  title: { type: String, default: '' },
  /** One sentence: what will appear here or what the user can do. */
  message: { type: String, default: '' },
  icon: { type: String, default: 'inbox' }
})
</script>

<style scoped>
.boms-empty-state {
  display: flex;
  align-items: flex-start;
  gap: var(--boms-space-3);
}
.boms-empty-state__icon {
  flex: 0 0 auto;
  color: var(--boms-color-text-muted);
}
.boms-empty-state__body {
  min-width: 0;
}
.boms-empty-state__title {
  margin: 0;
  color: var(--boms-color-heading);
  font-weight: 700;
}
.boms-empty-state__message {
  margin: var(--boms-space-1) 0 0;
  color: var(--boms-color-text-muted);
}
.boms-empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--boms-space-2);
  margin-top: var(--boms-space-3);
}
</style>
