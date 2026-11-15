<template>
  <!-- Keep dialogs mounted outside PageHeader's QMenu so closing the menu
       cannot unmount the dialog that its action just opened. -->
  <VariantManager ref="variantManager" hide-trigger @saved="emit('saved')" />
  <MaterialManager ref="materialManager" hide-trigger @saved="emit('saved')" />
  <AddPartnerButton
    ref="addSupplier"
    kind="supplier"
    hide-trigger
    @saved="result => emit('supplier-added', result)"
  />
  <PartnerProfiles
    ref="supplierProfiles"
    kind="supplier"
    hide-trigger
    @saved="emit('saved')"
  />
</template>

<script setup>
import { ref } from 'vue'
import VariantManager from '@/components/VariantManager.vue'
import MaterialManager from '@/components/MaterialManager.vue'
import AddPartnerButton from '@/components/AddPartnerButton.vue'
import PartnerProfiles from '@/components/PartnerProfiles.vue'

const emit = defineEmits(['saved', 'supplier-added'])
const variantManager = ref(null)
const materialManager = ref(null)
const addSupplier = ref(null)
const supplierProfiles = ref(null)

defineExpose({
  openVariants: () => variantManager.value?.show('list'),
  openMaterials: () => materialManager.value?.show('list'),
  openAddSupplier: () => addSupplier.value?.show(),
  openSupplierProfiles: () => supplierProfiles.value?.show()
})
</script>
