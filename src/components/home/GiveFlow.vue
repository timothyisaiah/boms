<template>
  <FlowDialog
    :model-value="modelValue"
    flow="give"
    title="Give jars to a retailer"
    icon="local_shipping"
    :primary-label="primaryLabel"
    primary-icon="local_shipping"
    :primary-disabled="!canSubmit"
    :submitting="write.submitting.value"
    :error="write.error.value"
    :retryable="write.retryable.value"
    :done="write.done.value"
    again-label="Give to another retailer"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="submit"
    @retry="write.retry"
    @again="start"
  >
    <template v-if="!retailer">
      <p class="flow-lead">Which retailer?</p>
      <div class="flow-choice" data-give-retailers>
        <button
          v-for="option in retailers"
          :key="option.id"
          type="button"
          class="flow-choice__item"
          @click="retailerId = Number(option.id)"
        >
          <span class="flow-choice__name">{{ option.retailer_name }}</span>
          <span class="flow-choice__hint">
            {{ option.delivery_location || 'No location' }} · holds
            {{ heldBy(option.id) }} jars
          </span>
        </button>
      </div>
      <p v-if="!retailers.length" class="flow-muted">
        No retailers yet. Add one from Distribution.
      </p>
    </template>

    <template v-else>
      <div class="flow-step">
        <p class="flow-lead">To {{ retailer.retailer_name }}</p>
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          label="Change"
          @click="retailerId = null"
        />
      </div>
      <ScanBar :feedback="basket.feedback.value" @scan="basket.onScan" />
      <JarPicker
        ref="picker"
        v-model="basket.counts.value"
        :variants="variants"
        :limits="inStore"
        :big-step="12"
      />
    </template>

    <template #summary>
      <p v-if="jars" class="flow-total">
        <span>Jars to hand over</span>
        <span class="flow-total__value tabular-nums">{{ jars }}</span>
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
import { countsToItems, jarLabel, totalJars } from '@/lib/simpleOps'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  variants: { type: Array, default: () => [] },
  retailers: { type: Array, default: () => [] },
  holdings: { type: Array, default: () => [] },
  /** `{ [variantId]: jars in store }` */
  inStore: { type: Object, default: () => ({}) },
  canLink: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'saved', 'barcode-linked'])

const picker = ref(null)
const retailerId = ref(null)
const write = useFlowWrite('stock-issues')
const basket = useScanBasket(
  () => props.variants,
  () => props.inStore,
  picker
)

const retailer = computed(() =>
  props.retailers.find(r => Number(r.id) === retailerId.value)
)
const jars = computed(() => totalJars(basket.counts.value))
const canSubmit = computed(() => Boolean(retailer.value) && jars.value > 0)
const primaryLabel = computed(() =>
  jars.value
    ? `Give ${jars.value} ${jars.value === 1 ? 'jar' : 'jars'}`
    : 'Give jars'
)
const heldBy = id =>
  props.holdings
    .filter(h => Number(h.retailer_id) === Number(id))
    .reduce((sum, h) => sum + (Number(h.quantity) || 0), 0)

function start() {
  retailerId.value =
    props.retailers.length === 1 ? Number(props.retailers[0].id) : null
  basket.reset()
  write.reset()
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
  const name = retailer.value.retailer_name
  const total = jars.value
  const result = await write.submit(
    {
      retailerId: retailerId.value,
      issuedAt: new Date().toISOString(),
      issueReference: null,
      notes: null,
      items
    },
    () => ({
      title: `${total} ${total === 1 ? 'jar' : 'jars'} given to ${name}`,
      lines: [
        ...items.map(
          i => `${i.quantity} × ${jarLabel(byId.get(i.variant_id))}`
        ),
        'They pay when the jars are sold (check in later).'
      ]
    })
  )
  if (result) emit('saved')
}
</script>

<style scoped src="./flow.css"></style>
