<template>
  <section
    class="surface-card dash-panel"
    aria-labelledby="dashboard-activity-title"
  >
    <header class="dash-panel__header">
      <h2 id="dashboard-activity-title" class="section-title dash-panel__title">
        Latest posted work
      </h2>
    </header>

    <ul v-if="items.length > 0" class="dash-rows" role="list">
      <li v-for="item in items" :key="item.id" class="dash-row">
        <div class="dash-row__main">
          <span class="dash-row__title">{{ item.title }}</span>
          <span class="dash-row__detail">
            {{ item.type }} / {{ item.subtitle }}
          </span>
          <span class="dash-row__meta">{{ formatDate(item.timestamp) }}</span>
        </div>
        <div class="dash-row__end">
          <span class="dash-row__value tabular-nums">
            {{ formatActivityValue(item) }}
          </span>
        </div>
      </li>
    </ul>

    <EmptyState
      v-else
      icon="history"
      title="No recent activity"
      message="Purchases, batches, dispatches, reviews, cash and expenses you can see appear here once posted."
    />
  </section>
</template>

<script setup>
import EmptyState from '@/components/EmptyState.vue'
import { formatDate } from '@/lib/format'
import { formatActivityValue } from '@/services/dashboard'

defineProps({
  items: { type: Array, default: () => [] }
})
</script>

<style scoped src="./dashboard-panel.css"></style>
