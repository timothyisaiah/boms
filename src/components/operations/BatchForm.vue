<template>
  <section class="ops-form" aria-labelledby="batch-form-title">
    <h2 id="batch-form-title" class="section-title ops-form__title"
      >Create a production batch</h2
    >
    <p class="ops-form__intro">
      Create a batch from open lots and keep cost per jar traceable.
    </p>

    <p v-if="needsLots" class="ops-form__notice" role="status">
      Production entry unlocks after live material lots exist. Record at least
      one purchase receipt first.
    </p>

    <DraftNotice v-if="draftRestored" @discard="emit('discard-draft')" />

    <q-form
      ref="formRef"
      class="ops-form__body"
      @submit="onSubmit"
      @validation-error="onValidationError"
    >
      <FormErrorSummary ref="summaryRef" :errors="errors" />

      <div class="inline-form-grid">
        <q-select
          v-model="state.variantId"
          :for="ids.variant"
          outlined
          :behavior="selectBehavior"
          lazy-rules
          :rules="[required]"
          emit-value
          map-options
          :disable="disabled || form.variantOptions.value.length === 0"
          :options="form.variantOptions.value"
          label="Finished variant"
        />

        <q-input
          v-model="state.startedOn"
          :for="ids.date"
          outlined
          type="date"
          lazy-rules
          :rules="[required]"
          :disable="disabled"
          label="Batch date"
        />

        <q-input
          v-model="state.batchCode"
          :for="ids.code"
          outlined
          lazy-rules
          :rules="[required]"
          :disable="disabled"
          label="Batch code"
          hint="Auto-suggested and incremented by date"
        />

        <q-input
          v-model="state.outputQuantity"
          :for="ids.output"
          outlined
          type="number"
          inputmode="numeric"
          lazy-rules
          :rules="[positive, whole]"
          min="1"
          step="1"
          :disable="disabled"
          label="Jars produced"
        />

        <q-input
          v-model="state.notes"
          for="batch-notes"
          outlined
          type="textarea"
          autogrow
          :disable="disabled"
          label="Batch notes"
        />
      </div>

      <q-input
        v-model="state.expiresAt"
        for="batch-expiry"
        class="q-mt-md"
        outlined
        type="date"
        label="Batch expiry date"
        hint="Use the actual batch expiry; leave blank only if not yet known."
        :disable="disabled"
      />

      <div v-if="form.matchingRecipe.value" class="ops-form__recipe">
        <p class="ops-form__recipe-text">
          Recipe: {{ form.matchingRecipe.value.name }}. Check and edit the
          actual quantities below.
        </p>
        <q-btn
          no-caps
          flat
          color="primary"
          type="button"
          label="Apply recipe quantities"
          :disable="disabled || !Number(state.outputQuantity)"
          @click="form.applyRecipe"
        />
      </div>

      <h3 class="ops-form__subheading">Consumed inputs</h3>

      <div class="line-item-stack">
        <article
          v-for="(input, index) in state.inputs"
          :key="input.key"
          class="line-item-card"
        >
          <div class="detail-row">
            <strong>Input {{ index + 1 }}</strong>
            <q-btn
              v-if="state.inputs.length > 1"
              flat
              round
              dense
              type="button"
              color="negative"
              icon="delete"
              aria-label="Remove line"
              :disable="disabled"
              @click="form.removeInput(input.key)"
            />
          </div>

          <div class="line-item-grid q-mt-md">
            <q-select
              v-model="input.inventoryLotId"
              :for="ids.input(index, 'lot')"
              outlined
              :behavior="selectBehavior"
              lazy-rules
              :rules="[required]"
              emit-value
              map-options
              :disable="disabled || form.inventoryLotOptions.value.length === 0"
              :options="form.inventoryLotOptions.value"
              label="Material lot"
            />

            <q-input
              v-model="input.quantity"
              :for="ids.input(index, 'quantity')"
              outlined
              type="number"
              inputmode="decimal"
              lazy-rules
              :rules="[positive]"
              min="0"
              step="0.001"
              :disable="disabled"
              label="Quantity consumed"
            />
          </div>

          <p
            v-if="form.resolveInventoryLot(input.inventoryLotId)"
            class="ops-form__lot-note"
          >
            {{ lotNote(form.resolveInventoryLot(input.inventoryLotId)) }}
          </p>
        </article>
      </div>

      <FormActionBar
        submit-label="Create production batch"
        action="production"
        :loading="submitting || checking"
        :disabled="disabled"
        @saved="result => emit('saved', result)"
      >
        <q-btn
          flat
          color="secondary"
          no-caps
          icon="add"
          type="button"
          label="Add input"
          :disable="disabled"
          @click="form.addInput"
        />
        <template #summary>
          <span class="status-chip status-chip--neutral">
            Input cost: {{ formatMoney(form.estimatedInputCost.value) }}
          </span>
          <span class="status-chip status-chip--info">
            Cost per jar: {{ formatMoney(form.estimatedUnitCost.value) }}
          </span>
        </template>
      </FormActionBar>
    </q-form>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import FormActionBar from '@/components/FormActionBar.vue'
import FormErrorSummary from '@/components/FormErrorSummary.vue'
import DraftNotice from '@/components/operations/DraftNotice.vue'
import {
  collectFieldErrors,
  focusField,
  useFormErrors
} from '@/composables/useFormErrors'
import { BATCH_FIELD_IDS as ids } from '@/composables/operations/useBatchForm'
import { formatMoney, formatQuantity } from '@/lib/format'
import { positive, required, whole } from '@/lib/validation'

const props = defineProps({
  /** useBatchForm() result, owned by the page. */
  form: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  /** Live data has no open lots: production cannot start yet. */
  needsLots: { type: Boolean, default: false },
  draftRestored: { type: Boolean, default: false }
})
const emit = defineEmits(['submit', 'saved', 'discard-draft'])

const $q = useQuasar()
const state = props.form.state
const formRef = ref(null)
const checking = ref(false)
const { errors, summaryRef, fail, clear } = useFormErrors()
const selectBehavior = computed(() => ($q.screen.lt.sm ? 'dialog' : 'menu'))

function lotNote(lot) {
  return `${lot.material?.name ?? 'Material'} / ${formatQuantity(
    lot.quantity_remaining,
    3
  )} ${lot.material?.unit_of_measure ?? 'units'} open at ${formatMoney(
    lot.unit_cost
  )}`
}

function onValidationError() {
  // QForm already ran validation before emitting this event. Calling
  // validate() again here re-emits validation-error recursively.
  void fail(collectFieldErrors(formRef))
}

async function onSubmit() {
  if (props.disabled || checking.value) return
  checking.value = true
  let result
  try {
    result = await props.form.prepare()
  } finally {
    checking.value = false
  }
  if (result.errors) {
    void fail(result.errors)
    return
  }
  clear()
  emit('submit', result.payload)
}

defineExpose({
  clearErrors: clear,
  focusFirstField: () => focusField(ids.variant)
})
</script>

<style scoped>
.ops-form__title {
  margin: 0;
}
.ops-form__intro {
  margin: var(--boms-space-1) 0 0;
  color: var(--boms-color-text-muted);
}
.ops-form__notice {
  margin: var(--boms-space-3) 0 0;
  padding: var(--boms-space-3) var(--boms-space-4);
  border: 1px solid var(--boms-color-warning-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-warning-bg);
  color: var(--boms-color-warning-text);
}
.ops-form__body {
  margin-top: var(--boms-space-4);
}
.ops-form__recipe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-2);
  margin-top: var(--boms-space-3);
  padding: var(--boms-space-2) var(--boms-space-3);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-success-bg);
  color: var(--boms-color-success-text);
}
.ops-form__recipe-text {
  flex: 1 1 14rem;
  margin: 0;
}
.ops-form__subheading {
  margin: var(--boms-space-6) 0 var(--boms-space-2);
  color: var(--boms-color-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: normal;
}
.ops-form__lot-note {
  margin: var(--boms-space-2) 0 0;
  color: var(--boms-color-text-muted);
  font-size: var(--boms-font-size-caption);
}
</style>
