<template>
  <q-page class="page-layout">
    <section class="page-hero">
      <div>
        <p class="page-hero__eyebrow">Profitability and review</p>
        <h1 class="page-hero__title">Finance workspace</h1>
        <p class="page-hero__body">
          Finance should see the business clearly without mutating operational
          truth. This route is ready for profitability, remittance, expense, and
          monthly review features once those modules are built.
        </p>
      </div>

      <div class="page-hero__actions">
        <q-btn color="primary" no-caps label="Back to dashboard" to="/" />
      </div>
    </section>

    <section class="card-grid card-grid--three">
      <q-card
        v-for="panel in panels"
        :key="panel.title"
        flat
        class="surface-card metric-card"
      >
        <q-card-section>
          <div class="section-label">{{ panel.label }}</div>
          <div class="section-title">{{ panel.title }}</div>
          <p class="text-body2 text-grey-8 q-mt-sm">{{ panel.text }}</p>
        </q-card-section>
      </q-card>
    </section>
  </q-page>
</template>

<script setup>
const panels = [
  {
    label: 'Remittances',
    title: 'Retail cash flow visibility',
    text: 'Track what each retailer has remitted, what remains outstanding, and which periods need follow-up.'
  },
  {
    label: 'Costing',
    title: 'Explainable batch economics',
    text: 'Connect material purchases, production inputs, and output quantities to reproducible cost per jar.'
  },
  {
    label: 'Review',
    title: 'Management-ready numbers',
    text: 'Surface the sales, stock, and profitability views needed for Beecone’s monthly business review.'
  }
]
</script>
