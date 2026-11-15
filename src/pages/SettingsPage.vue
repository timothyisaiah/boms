<template>
  <q-page class="page-layout">
    <section class="page-hero">
      <div>
        <p class="page-hero__eyebrow">Settings</p>
        <h1 class="page-hero__title">Catalogue settings</h1>
        <p class="page-hero__body">
          Set variant selling prices and the default materials each production
          recipe uses.
        </p>
      </div>
    </section>

    <CatalogueSettings />
  </q-page>
</template>

<script setup>
// Route access comes from the capability matrix (`settings:catalogue`):
// admin_owner and operations_manager, matching the server `settings`
// workspace and the `prices` / `recipes` write roles.
import CatalogueSettings from '@/components/CatalogueSettings.vue'
</script>
