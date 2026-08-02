<template>
  <q-page class="page-layout">
    <section class="page-hero">
      <div>
        <p class="page-hero__eyebrow">Distribution and reconciliation</p>
        <h1 class="page-hero__title">Retail workspace</h1>
        <p class="page-hero__body">
          Retail operations need a clean split between inventory issued to
          partners and the later reconciliation of sold, returned, damaged,
          remaining, remitted, and outstanding values.
        </p>
      </div>

      <div class="page-hero__actions">
        <q-btn
          color="primary"
          no-caps
          label="Open finance view"
          to="/finance"
        />
      </div>
    </section>

    <section class="card-grid card-grid--two">
      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Ledger checkpoints</div>
          <div class="section-title">Retail data this route protects</div>
        </q-card-section>

        <q-list separator class="surface-list">
          <q-item v-for="item in ledgerItems" :key="item">
            <q-item-section avatar>
              <q-icon name="inventory_2" color="secondary" />
            </q-item-section>
            <q-item-section>{{ item }}</q-item-section>
          </q-item>
        </q-list>
      </q-card>

      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Why it matters</div>
          <div class="section-title">Business rule preserved</div>
        </q-card-section>

        <q-card-section class="text-body2 text-grey-8">
          Beecone’s charter is explicit: stock issued to a retailer is not the
          same thing as a finalized sale. This protected workspace is where that
          distinction will live once the reconciliation module lands.
        </q-card-section>

        <q-separator inset />

        <q-card-section class="role-chip-row">
          <q-chip
            v-for="role in roles"
            :key="role"
            square
            color="green-1"
            text-color="green-10"
          >
            {{ role }}
          </q-chip>
        </q-card-section>
      </q-card>
    </section>
  </q-page>
</template>

<script setup>
const ledgerItems = [
  'Retail partner stock issues by batch and date.',
  'Reconciliation snapshots for sold, returned, damaged, and remaining units.',
  'Remitted versus outstanding balances by retailer and period.',
  'Future shop-to-shop transfers and exception handling.'
]

const roles = [
  'Admin / Owner',
  'Operations Manager',
  'Sales or Distribution Staff',
  'Finance / Accountant'
]
</script>
