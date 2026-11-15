<template>
  <q-btn
    v-if="allowed && !hideTrigger"
    color="primary"
    outline
    no-caps
    icon="add_business"
    :label="`Add ${kind}`"
    @click="show"
  />
  <q-dialog
    v-model="dialogOpen"
    persistent
    :maximized="$q.screen.lt.sm"
    :aria-labelledby="`add-${kind}-title`"
  >
    <q-card class="partner-dialog">
      <q-card-section class="manager-header">
        <h2 :id="`add-${kind}-title`" class="manager-title">Add {{ kind }}</h2>
        <q-btn
          flat
          round
          icon="close"
          :aria-label="`Close ${kind} form`"
          :disable="pending"
          @click="hide"
        />
      </q-card-section>
      <q-form
        ref="formRef"
        greedy
        no-error-focus
        @submit.prevent="save"
        @validation-error="onInvalid"
      >
        <q-card-section class="q-gutter-md">
          <WriteStatus :action="action" @saved="finish" />
          <FormErrorSummary ref="summaryRef" :errors="formErrors" />
          <q-input
            v-model="form.name"
            outlined
            :for="`add-${kind}-name`"
            :label="kind === 'supplier' ? 'Supplier name' : 'Retailer name'"
            :rules="[required]"
            :disable="locked"
            maxlength="160"
            autofocus
          />
          <q-select
            v-if="kind === 'supplier'"
            v-model="form.supplierKind"
            outlined
            for="add-supplier-kind"
            label="Supplier type"
            :options="supplierKinds"
            emit-value
            map-options
            :rules="[required]"
            :disable="locked"
            :behavior="selectBehavior"
          />
          <q-input
            v-model="form.contactName"
            outlined
            label="Contact person"
            :disable="locked"
            maxlength="120"
            autocomplete="off"
          />
          <q-input
            v-model="form.phone"
            outlined
            label="Phone number"
            type="tel"
            :disable="locked"
            maxlength="40"
            autocomplete="off"
          />
          <q-input
            v-model="form.email"
            outlined
            :for="`add-${kind}-email`"
            label="Contact email"
            type="email"
            :rules="[emailRule]"
            :disable="locked"
            maxlength="254"
            autocomplete="off"
          />
          <q-input
            v-if="kind === 'retailer'"
            v-model="form.deliveryLocation"
            outlined
            label="Delivery location"
            :disable="locked"
            maxlength="300"
          />
          <q-input
            v-model="form.notes"
            outlined
            label="Notes"
            type="textarea"
            autogrow
            :disable="locked"
            maxlength="2000"
          />
        </q-card-section>
        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat no-caps label="Close" :disable="pending" @click="hide" />
          <q-btn
            color="primary"
            no-caps
            :label="`Save ${kind}`"
            type="submit"
            :loading="pending"
            :disable="locked || !allowed"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { canWrite } from '@/constants/capabilities'
import { authState } from '@/services/auth'
import { writeAction, writeStates, isWriteLocked } from '@/services/writes'
import { required } from '@/lib/validation'
import { collectFieldErrors, useFormErrors } from '@/composables/useFormErrors'
import FormErrorSummary from '@/components/FormErrorSummary.vue'
import WriteStatus from '@/components/WriteStatus.vue'

const props = defineProps({
  kind: {
    type: String,
    required: true,
    validator: value => ['supplier', 'retailer'].includes(value)
  },
  /**
   * v-model:open. Controls the dialog from outside, e.g. from a PageHeader
   * overflow item. Leave unset to use the built-in button only.
   */
  open: { type: Boolean, default: undefined },
  /** Hide the built-in "Add supplier/retailer" button. */
  hideTrigger: Boolean
})
const emit = defineEmits(['saved', 'update:open'])
const $q = useQuasar()
// MF-17: touch-friendly dialog pickers on phones, keyboard menus elsewhere.
const selectBehavior = computed(() => ($q.screen.lt.sm ? 'dialog' : 'menu'))
const formRef = ref(null)
const {
  errors: formErrors,
  summaryRef,
  fail,
  clear: clearErrors
} = useFormErrors()
const dialogOpen = ref(false)
const blank = () => ({
  name: '',
  supplierKind: 'mixed',
  contactName: '',
  phone: '',
  email: '',
  deliveryLocation: '',
  notes: ''
})
const form = reactive(blank())
const action = computed(() => `${props.kind}s`)
const allowed = computed(() => canWrite(authState.role, action.value))
const pending = computed(() => writeStates[action.value]?.status === 'pending')
const locked = computed(() => isWriteLocked(action.value))
const supplierKinds = [
  { label: 'Raw honey', value: 'raw_honey' },
  { label: 'Packaging', value: 'packaging' },
  { label: 'Honey and packaging', value: 'mixed' },
  { label: 'Spice', value: 'spice' }
]
const emailRule = value =>
  !value ||
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ||
  'Enter a valid email address.'
/** Open the add form. No-op for roles that cannot create this partner. */
function show() {
  if (!allowed.value) return false
  clearErrors()
  dialogOpen.value = true
  return true
}
/** Close the dialog. Refused (returns false) while a save is pending. */
function hide() {
  if (pending.value) return false
  dialogOpen.value = false
  clearErrors()
  return true
}
watch(dialogOpen, value => {
  if (value !== props.open) emit('update:open', value)
})
watch(
  () => props.open,
  value => {
    if (value === true && !dialogOpen.value) show()
    else if (value === false && dialogOpen.value && !hide())
      emit('update:open', true)
  },
  { immediate: true }
)
async function onInvalid() {
  await nextTick()
  await fail(collectFieldErrors(formRef))
}
function finish(result) {
  emit('saved', result)
  Object.assign(form, blank())
  clearErrors()
  dialogOpen.value = false
  // Supplementary: the dialog closes, so the outcome is also confirmed by the
  // new partner being selected in the page form that opened it.
  $q.notify({
    type: 'positive',
    message: `${props.kind === 'supplier' ? 'Supplier' : 'Retailer'} added.`
  })
}
async function save() {
  if (locked.value || !allowed.value) return
  clearErrors()
  const body = {
    name: form.name.trim(),
    contactName: form.contactName.trim(),
    phone: form.phone.trim(),
    email: form.email.trim().toLowerCase(),
    notes: form.notes.trim()
  }
  if (props.kind === 'supplier') body.supplierKind = form.supplierKind
  else body.deliveryLocation = form.deliveryLocation.trim()
  try {
    finish(await writeAction(action.value, body))
  } catch {
    /* WriteStatus displays validation errors or the saved retry action. */
  }
}

defineExpose({ show, hide })
</script>

<style scoped>
.partner-dialog {
  width: 560px;
  max-width: 100%;
}
.manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-2);
}
.manager-title {
  margin: 0;
  color: var(--boms-color-heading);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: normal;
}
</style>
