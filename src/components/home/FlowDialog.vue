<template>
  <q-dialog
    :model-value="modelValue"
    :maximized="$q.screen.lt.sm"
    transition-show="slide-up"
    transition-hide="slide-down"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="flow-dialog" :data-flow="flow">
      <header class="flow-dialog__header">
        <q-icon :name="icon" size="28px" class="flow-dialog__icon" />
        <h2 class="flow-dialog__title">{{ done ? done.title : title }}</h2>
        <q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Close"
          @click="emit('update:modelValue', false)"
        />
      </header>

      <!-- Success: one clear outcome, then back to the home screen. -->
      <section v-if="done" class="flow-dialog__done" role="status">
        <q-icon
          name="check_circle"
          size="72px"
          class="flow-dialog__done-icon"
        />
        <ul class="flow-dialog__done-lines">
          <li v-for="line in done.lines" :key="line">{{ line }}</li>
        </ul>
      </section>

      <section v-else class="flow-dialog__body">
        <slot />
      </section>

      <footer class="flow-dialog__footer">
        <q-banner
          v-if="error && !done"
          dense
          rounded
          class="flow-dialog__error"
          role="alert"
        >
          <template #avatar><q-icon name="error_outline" /></template>
          {{ error }}
        </q-banner>
        <slot v-if="!done" name="summary" />
        <div class="flow-dialog__actions">
          <template v-if="done">
            <q-btn
              v-if="againLabel"
              outline
              no-caps
              color="primary"
              size="lg"
              :label="againLabel"
              class="flow-dialog__btn"
              @click="emit('again')"
            />
            <q-btn
              unelevated
              no-caps
              color="primary"
              size="lg"
              label="Done"
              class="flow-dialog__btn"
              data-flow-done
              @click="emit('update:modelValue', false)"
            />
          </template>
          <template v-else-if="retryable">
            <q-btn
              unelevated
              no-caps
              color="primary"
              size="lg"
              icon="refresh"
              label="Try again"
              class="flow-dialog__btn"
              :loading="submitting"
              @click="emit('retry')"
            />
          </template>
          <q-btn
            v-else
            unelevated
            no-caps
            color="primary"
            size="lg"
            :icon="primaryIcon"
            :label="primaryLabel"
            class="flow-dialog__btn"
            :disable="primaryDisabled"
            :loading="submitting"
            data-flow-submit
            @click="emit('submit')"
          />
        </div>
      </footer>
    </q-card>
  </q-dialog>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  flow: { type: String, default: '' },
  title: { type: String, required: true },
  icon: { type: String, default: 'bolt' },
  primaryLabel: { type: String, default: 'Save' },
  primaryIcon: { type: String, default: 'check' },
  primaryDisabled: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  error: { type: String, default: '' },
  /** A previous attempt may have reached the server: offer the same retry. */
  retryable: { type: Boolean, default: false },
  /** `{ title, lines[] }` once saved. */
  done: { type: Object, default: null },
  againLabel: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'submit', 'retry', 'again'])
</script>

<style scoped>
.flow-dialog {
  display: flex;
  flex-direction: column;
  width: min(560px, 100vw);
  max-height: 92vh;
  background: var(--boms-color-surface);
  border-radius: var(--boms-radius-lg);
}
.q-dialog__inner--maximized .flow-dialog {
  width: 100vw;
  max-height: 100vh;
  height: 100%;
  border-radius: 0;
}
.flow-dialog__header {
  display: flex;
  align-items: center;
  gap: var(--boms-space-2);
  padding: var(--boms-space-3) var(--boms-space-4);
  padding-top: calc(var(--boms-space-3) + var(--boms-safe-top));
  border-bottom: 1px solid var(--boms-color-border);
}
.flow-dialog__icon {
  color: var(--boms-color-primary);
}
.flow-dialog__title {
  flex: 1;
  margin: 0;
  font-size: var(--boms-font-size-section-title);
  font-weight: 800;
  color: var(--boms-color-heading);
  line-height: 1.3;
}
.flow-dialog__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--boms-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-4);
}
.flow-dialog__done {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--boms-space-3);
  padding: var(--boms-space-6) var(--boms-space-4);
  text-align: center;
}
.flow-dialog__done-icon {
  color: var(--boms-color-success);
}
.flow-dialog__done-lines {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: var(--boms-font-size-body);
  line-height: 1.6;
}
.flow-dialog__footer {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
  padding: var(--boms-space-3) var(--boms-space-4);
  padding-bottom: calc(var(--boms-space-3) + var(--boms-safe-bottom));
  border-top: 1px solid var(--boms-color-border);
  background: var(--boms-color-surface-subtle);
}
.flow-dialog__error {
  background: var(--boms-color-danger-bg);
  color: var(--boms-color-danger-text);
}
.flow-dialog__actions {
  display: flex;
  gap: var(--boms-space-2);
}
.flow-dialog__btn {
  flex: 1;
  min-height: 52px;
}
</style>
