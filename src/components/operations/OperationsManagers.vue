<template>
  <section ref="root" class="ops-managers" aria-labelledby="ops-managers-title">
    <h2 id="ops-managers-title" class="section-title ops-managers__title"
      >Catalogue and suppliers</h2
    >
    <!-- The managers render their own trigger buttons and dialogs. They stay
         mounted here (not inside the header's overflow QMenu, which unmounts
         on close) so the page header can open them via `open(label)`. -->
    <div class="ops-managers__actions">
      <VariantManager @saved="emit('saved')" />
      <MaterialManager @saved="emit('saved')" />
      <AddPartnerButton
        kind="supplier"
        @saved="result => emit('supplier-added', result)"
      />
      <PartnerProfiles kind="supplier" @saved="emit('saved')" />
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import VariantManager from '@/components/VariantManager.vue'
import MaterialManager from '@/components/MaterialManager.vue'
import AddPartnerButton from '@/components/AddPartnerButton.vue'
import PartnerProfiles from '@/components/PartnerProfiles.vue'

const emit = defineEmits(['saved', 'supplier-added'])
const root = ref(null)

/**
 * Activate a manager's own trigger button by its visible label, e.g.
 * "Manage variants". Returns false when the role does not have it.
 */
function open(label) {
  const button = [...(root.value?.querySelectorAll('button') ?? [])].find(
    // q-btn renders its label in `.block`; icon ligature text sits apart.
    element => element.querySelector('.block')?.textContent.trim() === label
  )
  if (!button) return false
  button.click()
  return true
}

defineExpose({ open })
</script>

<style scoped>
.ops-managers {
  padding-top: var(--boms-space-4);
  border-top: 1px solid var(--boms-color-border);
}
.ops-managers__title {
  margin: 0;
}
.ops-managers__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--boms-space-2);
  margin-top: var(--boms-space-3);
}
</style>
