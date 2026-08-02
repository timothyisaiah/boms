<template>
  <div class="fullscreen error-shell text-center q-pa-md flex flex-center">
    <div class="error-shell__card">
      <div class="error-shell__code"> 404 </div>

      <div class="text-h4 text-brown-10">
        This route is not part of the Beecone workspace.
      </div>

      <q-btn
        class="q-mt-xl"
        color="primary"
        unelevated
        to="/"
        label="Return to dashboard"
        no-caps
      />
    </div>
  </div>
</template>
