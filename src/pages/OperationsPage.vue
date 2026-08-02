<template>
  <q-page class="page-layout">
    <section class="page-hero">
      <div>
        <p class="page-hero__eyebrow">Supply and production</p>
        <h1 class="page-hero__title">Operations workspace</h1>
        <p class="page-hero__body">
          This route is reserved for the teams who turn raw honey and packaging
          into traceable finished stock. It is the right home for purchasing,
          batch creation, and warehouse movement workflows.
        </p>
      </div>

      <div class="page-hero__actions">
        <q-btn color="primary" no-caps label="Back to dashboard" to="/" />
      </div>
    </section>

    <section class="card-grid card-grid--two">
      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Primary workflow</div>
          <div class="section-title">What belongs here</div>
        </q-card-section>

        <q-list separator class="surface-list">
          <q-item v-for="step in workflowSteps" :key="step">
            <q-item-section avatar>
              <q-icon name="check_circle" color="primary" />
            </q-item-section>
            <q-item-section>{{ step }}</q-item-section>
          </q-item>
        </q-list>
      </q-card>

      <q-card flat class="surface-card">
        <q-card-section>
          <div class="section-label">Access model</div>
          <div class="section-title">Roles allowed on this route</div>
        </q-card-section>

        <q-card-section class="role-chip-row">
          <q-chip
            v-for="role in roles"
            :key="role"
            square
            color="amber-2"
            text-color="brown-10"
          >
            {{ role }}
          </q-chip>
        </q-card-section>

        <q-separator inset />

        <q-card-section class="text-body2 text-grey-8">
          The frontend already blocks everyone else from reaching this
          workspace. The next step is to mirror the same role rules in Supabase
          RLS so the data layer enforces them too.
        </q-card-section>
      </q-card>
    </section>
  </q-page>
</template>

<script setup>
const workflowSteps = [
  'Capture raw honey and packaging purchases as auditable receipts.',
  'Create production batches that consume real material inputs.',
  'Record finished outputs at the batch level for warehouse traceability.',
  'Keep inventory movement separate from retail sale recognition.'
]

const roles = [
  'Admin / Owner',
  'Operations Manager',
  'Production Staff',
  'Warehouse Staff'
]
</script>
