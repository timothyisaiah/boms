<template>
  <div class="draft-notice" role="status">
    <q-icon name="restore" size="20px" aria-hidden="true" />
    <p class="draft-notice__text">Draft restored from this device.</p>
    <q-btn
      flat
      dense
      no-caps
      color="primary"
      label="Discard draft"
      @click="emit('discard')"
    />
  </div>
</template>

<script setup>
const emit = defineEmits(['discard'])
</script>

<style scoped>
.draft-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--boms-space-2) var(--boms-space-3);
  margin-top: var(--boms-space-3);
  padding: var(--boms-space-2) var(--boms-space-3);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface-subtle);
}
.draft-notice :deep(.q-icon) {
  flex: 0 0 auto;
  overflow: hidden;
}
.draft-notice__text {
  flex: 1 1 10rem;
  margin: 0;
}
</style>
