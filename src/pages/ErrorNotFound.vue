<template>
  <div class="fullscreen error-shell text-center q-pa-md flex flex-center">
    <main class="error-shell__card">
      <p class="error-shell__code" aria-hidden="true"> 404 </p>

      <h1 class="error-shell__title">Page not found</h1>
      <p class="q-mt-sm q-mb-none text-body1">
        This route is not part of the Beecone workspace.
      </p>

      <q-btn
        class="q-mt-xl"
        color="primary"
        unelevated
        to="/"
        label="Return to dashboard"
        no-caps
      />
    </main>
  </div>
</template>
