<template>
  <router-view v-if="authState.initialized" />

  <div v-else class="app-splash">
    <q-spinner-puff color="warning" size="56px" />
    <p class="app-splash__eyebrow">Beecone Honey</p>
    <h1 class="app-splash__title">Preparing your BOMS workspace</h1>
  </div>
</template>

<script setup>
import { authState } from '@/services/auth'
</script>
