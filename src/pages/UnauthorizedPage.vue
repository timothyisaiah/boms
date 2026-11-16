<template>
  <q-page class="page-layout page-layout--centered">
    <q-card flat class="surface-card unauthorized-card">
      <q-card-section class="text-center">
        <q-icon name="lock" color="negative" size="56px" aria-hidden="true" />
        <h1 class="section-title unauthorized-card__title q-mt-md"
          >Access restricted</h1
        >
        <p class="text-body1 q-mt-sm unauthorized-card__body">
          You’re signed in, but this workspace is restricted. Your account does
          not currently include the role required for this route. Ask a Beecone
          admin to review your role assignment.
        </p>
      </q-card-section>

      <q-card-actions align="center">
        <q-btn color="primary" no-caps label="Back to dashboard" to="/" />
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<style scoped>
.unauthorized-card__title {
  font-size: var(--boms-font-size-page-title);
}
.unauthorized-card__body {
  color: var(--boms-color-text-muted);
}
</style>
