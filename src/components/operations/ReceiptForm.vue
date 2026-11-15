<template>
  <section class="ops-form" aria-labelledby="receipt-form-title">
    <h2 id="receipt-form-title" class="section-title ops-form__title"
      >Record a material receipt</h2
    >
    <p class="ops-form__intro">
      Post receipts with lot codes so production can consume real stock.
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
          v-model="state.supplierId"
          :for="ids.supplier"
          outlined
          :behavior="selectBehavior"
          lazy-rules
          :rules="[required]"
          emit-value
          map-options
          :disable="disabled || supplierOptions.length === 0"
          :options="supplierOptions"
          label="Supplier"
        />

        <q-input
          v-model="state.purchasedOn"
          :for="ids.date"
          outlined
          type="date"
          lazy-rules
          :rules="[required]"
          :disable="disabled"
          label="Purchase date"
        />

        <q-input
          v-model="state.purchaseReference"
          for="purchase-reference"
          outlined
          :disable="disabled"
          label="Reference"
          hint="Optional invoice or delivery note"
        />

        <q-input
          v-model="state.notes"
          for="purchase-notes"
          outlined
          type="textarea"
          autogrow
          :disable="disabled"
          label="Notes"
        />
      </div>

      <h3 class="ops-form__subheading">Line items</h3>

      <div class="line-item-stack">
        <article
          v-for="(item, index) in state.items"
          :key="item.key"
          class="line-item-card"
        >
          <div class="detail-row">
            <strong>Line {{ index + 1 }}</strong>
            <q-btn
              v-if="state.items.length > 1"
              flat
              round
              dense
              type="button"
              color="negative"
              icon="delete"
              aria-label="Remove line"
              :disable="disabled"
              @click="form.removeLine(item.key)"
            />
          </div>

          <div class="line-item-grid q-mt-md">
            <q-select
              v-model="item.materialId"
              :for="ids.line(index, 'material')"
              outlined
              :behavior="selectBehavior"
              lazy-rules
              :rules="[required]"
              emit-value
              map-options
              :disable="disabled || materialOptions.length === 0"
              :options="materialOptions"
              label="Material"
            />

            <q-input
              v-model="item.quantity"
              :for="ids.line(index, 'quantity')"
              outlined
              type="number"
              inputmode="decimal"
              lazy-rules
              :rules="[positive]"
              min="0"
              step="0.001"
              :disable="disabled"
              label="Quantity"
            />

            <q-input
              v-model="item.unitCost"
              :for="ids.line(index, 'unit-cost')"
              outlined
              type="number"
              inputmode="decimal"
              lazy-rules
              :rules="[nonnegative]"
              min="0"
              step="0.01"
              :disable="disabled"
              label="Unit cost (UGX)"
            />

            <q-input
              v-model="item.lotCode"
              :for="ids.line(index, 'lot-code')"
              outlined
              :disable="disabled"
              label="Lot code"
              hint="Optional, auto-generated when blank"
            />
          </div>
        </article>
      </div>

      <FormActionBar
        submit-label="Record purchase"
        action="purchases"
        :loading="submitting"
        :disabled="disabled"
        @saved="result => emit('saved', result)"
      >
        <q-btn
          flat
          color="secondary"
          no-caps
          icon="add"
          type="button"
          label="Add line"
          :disable="disabled"
          @click="form.addLine"
        />
        <template #summary>
          <span class="status-chip status-chip--neutral">
            Estimated receipt total: {{ formatMoney(form.total.value) }}
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
import { RECEIPT_FIELD_IDS as ids } from '@/composables/operations/useReceiptForm'
import { formatMoney } from '@/lib/format'
import { nonnegative, positive, required } from '@/lib/validation'

const props = defineProps({
  /** useReceiptForm() result, owned by the page. */
  form: { type: Object, required: true },
  supplierOptions: { type: Array, default: () => [] },
  materialOptions: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  draftRestored: { type: Boolean, default: false }
})
const emit = defineEmits(['submit', 'saved', 'discard-draft'])

const $q = useQuasar()
const state = props.form.state
const formRef = ref(null)
const { errors, summaryRef, fail, clear } = useFormErrors()
// Phones keep the full-screen option list; larger screens use a menu that
// works with the keyboard without a modal (MF-17).
const selectBehavior = computed(() => ($q.screen.lt.sm ? 'dialog' : 'menu'))

function onValidationError() {
  // QForm already ran validation before emitting this event. Calling
  // validate() again here re-emits validation-error recursively.
  void fail(collectFieldErrors(formRef))
}

function onSubmit() {
  if (props.disabled) return
  const result = props.form.build()
  if (result.errors) {
    void fail(result.errors)
    return
  }
  clear()
  emit('submit', result.payload)
}

defineExpose({
  clearErrors: clear,
  focusFirstField: () => focusField(ids.supplier)
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
.ops-form__body {
  margin-top: var(--boms-space-4);
}
.ops-form__subheading {
  margin: var(--boms-space-6) 0 var(--boms-space-2);
  color: var(--boms-color-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: normal;
}
</style>
