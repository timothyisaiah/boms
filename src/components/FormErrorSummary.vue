<template>
  <div
    v-if="errors.length"
    ref="root"
    class="form-error-summary"
    role="alert"
    tabindex="-1"
  >
    <component :is="`h${headingLevel}`" class="form-error-summary__title">
      {{ title }}
    </component>
    <ul class="form-error-summary__list">
      <li v-for="(error, index) in errors" :key="`${error.id}-${index}`">
        <a
          v-if="error.id"
          :href="`#${error.id}`"
          @click.prevent="focusField(error.id)"
          >{{ text(error) }}</a
        >
        <span v-else>{{ text(error) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { focusField } from '@/composables/useFormErrors'

defineProps({
  /** `[{ id?, label?, message }]`; `id` is the native control's id. */
  errors: { type: Array, default: () => [] },
  title: { type: String, default: 'Check the highlighted fields' },
  headingLevel: {
    type: Number,
    default: 3,
    validator: value => value >= 2 && value <= 6
  }
})

const root = ref(null)
const text = error =>
  error.label ? `${error.label}: ${error.message}` : error.message

defineExpose({
  /** Move focus to the summary (e.g. for errors not tied to a field). */
  focus: () => root.value?.focus()
})
</script>

<style scoped>
.form-error-summary {
  margin: var(--boms-space-4) 0;
  padding: var(--boms-space-3) var(--boms-space-4);
  border: 2px solid var(--boms-color-danger);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-danger-bg);
  color: var(--boms-color-text);
}
.form-error-summary:focus-visible {
  outline: 3px solid var(--boms-color-focus);
  outline-offset: 2px;
}
.form-error-summary__title {
  margin: 0;
  color: var(--boms-color-danger-text);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: normal;
}
.form-error-summary__list {
  margin: var(--boms-space-2) 0 0;
  padding-left: 1.25rem;
}
.form-error-summary__list li + li {
  margin-top: var(--boms-space-1);
}
.form-error-summary__list a {
  display: inline-block;
  min-height: 24px;
  color: var(--boms-color-danger-text);
  font-weight: 700;
  text-decoration: underline;
  overflow-wrap: anywhere;
}
</style>
