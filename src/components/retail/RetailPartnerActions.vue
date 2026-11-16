<template>
  <!-- These dialogs stay mounted outside PageHeader's transient QMenu. -->
  <AddPartnerButton
    ref="addRef"
    kind="retailer"
    hide-trigger
    @saved="result => emit('added', result)"
  />
  <PartnerProfiles
    ref="manageRef"
    kind="retailer"
    hide-trigger
    @saved="result => emit('updated', result)"
  />
</template>

<script setup>
import { ref } from 'vue'
import AddPartnerButton from '@/components/AddPartnerButton.vue'
import PartnerProfiles from '@/components/PartnerProfiles.vue'

const emit = defineEmits(['added', 'updated'])
const addRef = ref(null)
const manageRef = ref(null)

defineExpose({
  /** Open the shared "Add retailer" dialog. */
  openAdd: () => addRef.value?.show(),
  /** Open the shared retailer profile manager dialog. */
  openManage: () => manageRef.value?.show()
})
</script>
