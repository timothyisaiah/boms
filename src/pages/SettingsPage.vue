<template>
  <q-page class="page-layout">
    <PageHeader
      title="Catalogue settings"
      subtitle="Variant selling prices and default recipe materials."
      overflow-label="Catalogue actions"
      :actions="[
        {
          label: 'Manage variants',
          icon: 'category',
          handler: () => (variantsOpen = true)
        },
        {
          label: 'Manage materials',
          icon: 'inventory_2',
          handler: () => (materialsOpen = true)
        }
      ]"
    />

    <CatalogueSettings ref="catalogue" />

    <!--
      The managers render their dialogs here, outside the PageHeader menu, so
      the dialog survives the menu closing (docs/audits/components.md,
      "Manager components").
    -->
    <VariantManager
      v-model:open="variantsOpen"
      hide-trigger
      @saved="catalogue?.reload()"
    />
    <MaterialManager
      v-model:open="materialsOpen"
      hide-trigger
      @saved="catalogue?.reload()"
    />
  </q-page>
</template>

<script setup>
// Route access comes from the capability matrix (`settings:catalogue`):
// admin_owner and operations_manager, matching the server `settings`
// workspace and the `prices` / `recipes` write roles. Both roles can also
// write variants and materials, so the catalogue managers are offered here.
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import CatalogueSettings from '@/components/CatalogueSettings.vue'
import MaterialManager from '@/components/MaterialManager.vue'
import VariantManager from '@/components/VariantManager.vue'

const catalogue = ref(null)
const variantsOpen = ref(false)
const materialsOpen = ref(false)
</script>
