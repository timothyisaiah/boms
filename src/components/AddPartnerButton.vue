<template>
  <q-btn
    v-if="allowed"
    color="primary"
    outline
    no-caps
    icon="add_business"
    :label="`Add ${kind}`"
    @click="open = true"
  />
  <q-dialog v-model="open" persistent :maximized="$q.screen.lt.sm">
    <q-card class="partner-dialog">
      <q-card-section class="row items-center justify-between">
        <h2 class="text-h6 q-my-none">Add {{ kind }}</h2>
        <q-btn
          flat
          round
          icon="close"
          :aria-label="`Close ${kind} form`"
          :disable="pending"
          @click="open = false"
        />
      </q-card-section>
      <q-form @submit.prevent="save">
        <q-card-section class="q-gutter-md">
          <WriteStatus :action="action" @saved="finish" />
          <q-input
            v-model="form.name"
            outlined
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
            label="Supplier type"
            :options="supplierKinds"
            emit-value
            map-options
            :rules="[required]"
            :disable="locked"
            behavior="dialog"
          />
          <q-input
            v-model="form.contactName"
            outlined
            label="Contact person"
            :disable="locked"
            maxlength="120"
            autocomplete="name"
          />
          <q-input
            v-model="form.phone"
            outlined
            label="Phone number"
            type="tel"
            :disable="locked"
            maxlength="40"
            autocomplete="tel"
          />
          <q-input
            v-model="form.email"
            outlined
            label="Contact email"
            type="email"
            :rules="[emailRule]"
            :disable="locked"
            maxlength="254"
            autocomplete="email"
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
          <q-btn
            flat
            no-caps
            label="Close"
            :disable="pending"
            @click="open = false"
          />
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
import { computed, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { authState } from '@/services/auth'
import { writeAction, writeStates, isWriteLocked } from '@/services/writes'
import { required } from '@/lib/validation'
import WriteStatus from '@/components/WriteStatus.vue'

const props = defineProps({
  kind: {
    type: String,
    required: true,
    validator: value => ['supplier', 'retailer'].includes(value)
  }
})
const emit = defineEmits(['saved'])
const $q = useQuasar()
const open = ref(false)
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
const allowed = computed(() =>
  [
    'admin_owner',
    'operations_manager',
    'warehouse_staff',
    ...(props.kind === 'retailer' ? ['sales_or_distribution_staff'] : [])
  ].includes(authState.role)
)
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
function finish(result) {
  emit('saved', result)
  Object.assign(form, blank())
  open.value = false
  $q.notify({
    type: 'positive',
    message: `${props.kind === 'supplier' ? 'Supplier' : 'Retailer'} added.`
  })
}
async function save() {
  if (locked.value || !allowed.value) return
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
</script>

<style scoped>
.partner-dialog {
  width: 560px;
  max-width: 100%;
}
</style>
