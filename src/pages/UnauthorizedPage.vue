<template>
  <q-page class="page-layout page-layout--centered">
    <q-card flat class="surface-card unauthorized-card">
      <q-card-section class="text-center">
        <q-icon name="lock" color="negative" size="56px" />
        <div class="section-title q-mt-md"
          >You’re signed in, but this workspace is restricted.</div
        >
        <p class="text-body1 text-grey-8 q-mt-sm">
          Your account does not currently include the role required for this
          route. Ask a Beecone admin to review your role assignment in Supabase.
        </p>
      </q-card-section>

      <q-card-actions align="center">
        <q-btn color="primary" no-caps label="Back to dashboard" to="/" />
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<script setup>
//
</script>
