<template>
  <FlowDialog
    :model-value="modelValue"
    flow="sell"
    title="Sell to a customer"
    icon="point_of_sale"
    :primary-label="primaryLabel"
    primary-icon="payments"
    :primary-disabled="!canSubmit"
    :submitting="write.submitting.value"
    :error="write.error.value"
    :retryable="write.retryable.value"
    :done="write.done.value"
    again-label="New sale"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="submit"
    @retry="write.retry"
    @again="start"
  >
    <ScanBar :feedback="basket.feedback.value" @scan="basket.onScan" />
    <JarPicker
      ref="picker"
      v-model="basket.counts.value"
      :variants="variants"
      :limits="inStore"
      show-price
      :big-step="0"
    />
    <div class="sell__pay">
      <p class="flow-lead">Paid by</p>
      <q-btn-toggle
        v-model="paymentMethod"
        spread
        no-caps
        unelevated
        toggle-color="primary"
        color="grey-3"
        text-color="brown-10"
        :options="paymentOptions"
        data-sell-payment
      />
      <q-input
        v-model="customerName"
        dense
        outlined
        label="Customer name (optional)"
      />
    </div>

    <template #summary>
      <p v-if="priced.missing.length" class="flow-uses__warn">
        No selling price for
        {{ priced.missing.map(jarLabel).join(', ') }}. Set it in Catalogue
        settings.
      </p>
      <p v-if="jars" class="flow-total">
        <span>{{ jars }} {{ jars === 1 ? 'jar' : 'jars' }}</span>
        <span class="flow-total__value tabular-nums">{{
          formatMoney(priced.total)
        }}</span>
      </p>
    </template>
  </FlowDialog>

  <LinkBarcodeDialog
    :code="basket.unknownCode.value"
    :variants="variants"
    :can-link="canLink"
    @linked="linked"
    @cancel="basket.unknownCode.value = ''"
  />
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import FlowDialog from './FlowDialog.vue'
import JarPicker from './JarPicker.vue'
import ScanBar from './ScanBar.vue'
import LinkBarcodeDialog from './LinkBarcodeDialog.vue'
import { useFlowWrite } from '@/composables/useFlowWrite'
import { useScanBasket } from '@/composables/useScanBasket'
import { formatMoney } from '@/lib/format'
import {
  basketTotal,
  countsToItems,
  jarLabel,
  totalJars
} from '@/lib/simpleOps'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  variants: { type: Array, default: () => [] },
  inStore: { type: Object, default: () => ({}) },
  canLink: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'saved', 'barcode-linked'])

const paymentOptions = [
  { label: 'Cash', value: 'cash' },
  { label: 'Mobile money', value: 'mobile_money' },
  { label: 'Bank', value: 'bank' }
]
const picker = ref(null)
const paymentMethod = ref('cash')
const customerName = ref('')
const write = useFlowWrite('direct-sales')
const basket = useScanBasket(
  () => props.variants,
  () => props.inStore,
  picker
)

const jars = computed(() => totalJars(basket.counts.value))
const priced = computed(() => basketTotal(basket.counts.value, props.variants))
const canSubmit = computed(
  () => jars.value > 0 && priced.value.missing.length === 0
)
const primaryLabel = computed(() =>
  jars.value ? `Sold — ${formatMoney(priced.value.total)}` : 'Record sale'
)

function start() {
  basket.reset()
  write.reset()
  paymentMethod.value = 'cash'
  customerName.value = ''
}
watch(
  () => props.modelValue,
  open => {
    if (open && !write.retryable.value) start()
  }
)

function linked(variantId, code) {
  basket.onLinked(variantId, code)
  emit('barcode-linked')
}

async function submit() {
  const items = countsToItems(basket.counts.value)
  const byId = new Map(props.variants.map(v => [Number(v.id), v]))
  const total = priced.value.total
  const method = paymentOptions.find(
    o => o.value === paymentMethod.value
  )?.label
  const result = await write.submit(
    {
      soldAt: new Date().toISOString(),
      customerName: customerName.value.trim() || null,
      paymentMethod: paymentMethod.value,
      saleReference: null,
      notes: null,
      items
    },
    () => ({
      title: `Sale recorded — ${formatMoney(total)}`,
      lines: [
        ...items.map(
          i => `${i.quantity} × ${jarLabel(byId.get(i.variant_id))}`
        ),
        `Paid by ${method}`
      ]
    })
  )
  if (result) emit('saved')
}
</script>

<style scoped src="./flow.css"></style>
<style scoped>
.sell__pay {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
}
</style>
