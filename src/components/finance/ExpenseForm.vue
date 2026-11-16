<template>
  <section class="finance-form" :aria-labelledby="headingId">
    <div class="finance-form__intro">
      <h2 :id="headingId" class="section-title finance-form__title">
        Record an operating expense
      </h2>
      <p class="finance-form__lead">
        Operating expenses reduce the margin view without changing inventory.
      </p>
    </div>

    <SaveConfirmation
      v-if="confirmation"
      :title="confirmation.title"
      :details="confirmation.details"
      @dismiss="confirmation = null"
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="add"
        label="Record another expense"
        @click="startAnother"
      />
      <q-btn
        flat
        no-caps
        color="primary"
        icon="history"
        label="View records"
        @click="emit('navigate', { view: 'records' })"
      />
    </SaveConfirmation>

    <p v-if="writeMessage" class="finance-form__notice" role="note">
      {{ writeMessage }}
    </p>

    <p v-if="restored" class="finance-form__draft" role="status">
      <q-icon name="restore" size="20px" aria-hidden="true" />
      <span>Draft restored.</span>
      <q-btn
        flat
        dense
        no-caps
        color="primary"
        label="Discard draft"
        @click="discardDraft"
      />
    </p>

    <q-form
      ref="formRef"
      class="finance-form__form"
      @submit="submit"
      @validation-error="reportFieldErrors"
    >
      <FormErrorSummary ref="summaryRef" :errors="errors" />

      <div class="finance-form__grid">
        <q-input
          v-model="form.expenseCategory"
          for="expense-category"
          outlined
          :disable="writesDisabled"
          label="Expense category"
        />
        <q-input
          v-model="form.incurredOn"
          for="expense-date"
          outlined
          type="date"
          lazy-rules
          :rules="[required]"
          :disable="writesDisabled"
          label="Expense date"
        />
        <q-input
          v-model="form.amount"
          for="expense-amount"
          outlined
          type="number"
          inputmode="decimal"
          lazy-rules
          :rules="[positive]"
          min="0"
          step="100"
          :disable="writesDisabled"
          label="Expense amount"
        />
        <q-input
          v-model="form.vendorName"
          for="expense-vendor"
          outlined
          :disable="writesDisabled"
          label="Vendor or payee"
        />
        <q-input
          v-model="form.expenseReference"
          for="expense-reference"
          outlined
          :disable="writesDisabled"
          label="Reference"
          hint="Optional invoice, fuel, or voucher number"
        />
        <q-input
          v-model="form.notes"
          for="expense-notes"
          outlined
          type="textarea"
          autogrow
          :disable="writesDisabled"
          label="Notes"
        />
      </div>

      <FormActionBar
        submit-label="Record expense"
        action="expenses"
        :loading="isSubmitting"
        :disabled="writesDisabled"
        @saved="onRetrySaved"
      />
    </q-form>
  </section>
</template>

<script setup>
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'
import { useQuasar } from 'quasar'
import FormActionBar from '@/components/FormActionBar.vue'
import FormErrorSummary from '@/components/FormErrorSummary.vue'
import SaveConfirmation from '@/components/SaveConfirmation.vue'
import { useFormDraft } from '@/composables/useFormDraft'
import { collectFieldErrors, useFormErrors } from '@/composables/useFormErrors'
import { isWriteLocked } from '@/services/writes'
import { required, positive } from '@/lib/validation'
import { formatMoney, getTodayString } from '@/lib/format'
import { formatFinanceError, recordOperatingExpense } from '@/services/finance'
import {
  buildExpensePayload,
  validateExpense
} from '@/components/finance/financeDomain'

const props = defineProps({
  mode: { type: String, required: true },
  canWrite: { type: Boolean, default: false },
  afterSave: { type: Function, default: async () => {} }
})
const emit = defineEmits(['dirty', 'navigate'])

const $q = useQuasar()
const headingId = useId()
const formRef = ref(null)
const isSubmitting = ref(false)
const confirmation = ref(null)
const { errors, summaryRef, fail, clear } = useFormErrors()

const form = reactive({
  expenseCategory: '',
  incurredOn: getTodayString(),
  amount: '',
  vendorName: '',
  expenseReference: '',
  notes: ''
})
const { isDirty, restored, clearDraft } = useFormDraft('finance:expense', form)
watch(isDirty, dirty => emit('dirty', dirty), { immediate: true })

const isLive = computed(() => ['live', 'refreshing'].includes(props.mode))
const writesDisabled = computed(
  () =>
    !isLive.value ||
    isSubmitting.value ||
    isWriteLocked('expenses') ||
    !props.canWrite
)
const writeMessage = computed(() => {
  if (props.mode === 'loading') return ''
  if (!isLive.value)
    return 'Live entry is unavailable. Refresh the workspace to reconnect.'
  if (!props.canWrite)
    return 'Your role can review expenses, but only admin, operations, and finance roles can record them.'
  return ''
})

function resetForm() {
  form.expenseCategory = ''
  form.incurredOn = getTodayString()
  form.amount = ''
  form.vendorName = ''
  form.expenseReference = ''
  form.notes = ''
  formRef.value?.resetValidation()
  clear()
}

function discardDraft() {
  resetForm()
  clearDraft()
}

async function reportFieldErrors() {
  await nextTick()
  await fail(collectFieldErrors(formRef.value))
}

async function completeSave({ retry = false } = {}) {
  // A confirmed retry posted the saved body, which may differ from what the
  // form shows now, so describe it generically.
  const outcome = retry
    ? {
        title: 'Saved expense confirmed',
        details: ['The margin view has been refreshed.']
      }
    : {
        title: `Expense of ${formatMoney(form.amount)} recorded`,
        details: [
          `${form.expenseCategory.trim()}${form.vendorName.trim() ? ` / ${form.vendorName.trim()}` : ''}.`,
          'The margin view has been refreshed.'
        ]
      }
  resetForm()
  clearDraft()
  await props.afterSave()
  confirmation.value = outcome
}

async function submit() {
  if (writesDisabled.value) return
  const problems = validateExpense(form)
  if (problems.length) {
    await fail(problems)
    return
  }
  clear()
  confirmation.value = null
  isSubmitting.value = true
  try {
    await recordOperatingExpense(buildExpensePayload(form))
    await completeSave()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: formatFinanceError(
        error,
        'Unable to record the expense right now.'
      )
    })
  } finally {
    isSubmitting.value = false
  }
}

async function onRetrySaved() {
  await completeSave({ retry: true })
}

async function startAnother() {
  confirmation.value = null
  await nextTick()
  document.getElementById('expense-category')?.focus()
}
</script>

<style scoped src="./financeForm.css"></style>
