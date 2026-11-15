<template>
  <!--
    The shared partner components render their own trigger button and dialog
    with internal open state. Their triggers are kept here, outside the page
    header's overflow QMenu, so the dialogs (teleported to <body>) survive the
    menu closing; the menu items click the hidden triggers.
  -->
  <div class="retail-partner-actions" aria-hidden="true">
    <span ref="addRef"
      ><AddPartnerButton
        kind="retailer"
        @saved="result => emit('added', result)"
    /></span>
    <span ref="manageRef"
      ><PartnerProfiles
        kind="retailer"
        @saved="result => emit('updated', result)"
    /></span>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AddPartnerButton from '@/components/AddPartnerButton.vue'
import PartnerProfiles from '@/components/PartnerProfiles.vue'

const emit = defineEmits(['added', 'updated'])
const addRef = ref(null)
const manageRef = ref(null)

const trigger = container => {
  const button = container.value?.querySelector('button, .q-btn')
  if (!button) return false
  button.click()
  return true
}

defineExpose({
  /** Open the shared "Add retailer" dialog. */
  openAdd: () => trigger(addRef),
  /** Open the shared retailer profile manager dialog. */
  openManage: () => trigger(manageRef)
})
</script>

<style scoped>
.retail-partner-actions {
  display: none;
}
</style>
