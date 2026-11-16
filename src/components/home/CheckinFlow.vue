<template>
  <FlowDialog
    :model-value="modelValue"
    flow="checkin"
    title="Check in a retailer"
    icon="fact_check"
    :primary-label="primaryLabel"
    :primary-disabled="!canSubmit"
    :submitting="write.submitting.value"
    :error="write.error.value"
    :retryable="write.retryable.value"
    :done="write.done.value"
    again-label="Check in another"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="submit"
    @retry="write.retry"
    @again="start"
  >
    <template v-if="!retailer">
      <p class="flow-lead">Which retailer are you visiting?</p>
      <div class="flow-choice" data-checkin-retailers>
        <button
          v-for="option in candidates"
          :key="option.id"
          type="button"
          class="flow-choice__item"
          @click="choose(option.id)"
        >
          <span class="flow-choice__name">{{ option.retailer_name }}</span>
          <span class="flow-choice__hint">
            Holds {{ heldTotal(option.id) }} jars
            <template v-if="owed(option.id) > 0">
              · owes {{ formatMoney(owed(option.id)) }}</template
            >
          </span>
        </button>
      </div>
      <p v-if="!candidates.length" class="flow-muted">
        No retailer is holding jars or owing money right now.
      </p>
    </template>

    <template v-else>
      <div class="flow-step">
        <p class="flow-lead">{{ retailer.retailer_name }}</p>
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          label="Change"
          @click="retailerId = null"
        />
      </div>

      <template v-if="heldVariants.length">
        <p class="flow-muted">
          Count the jars still on their shelf. Everything else is recorded as
          sold.
        </p>
        <ScanBar :feedback="feedback" @scan="onScan" />
        <JarPicker
          ref="picker"
          v-model="shelf"
          :variants="heldVariants"
          :limits="heldMap"
          stock-label="given, not yet sold"
          :big-step="0"
        />
        <q-toggle v-model="showDamaged" label="Some jars were damaged" />
        <template v-if="showDamaged">
          <p class="flow-muted">How many were damaged (not paid for)?</p>
          <JarPicker
            v-model="damaged"
            :variants="heldVariants"
            :limits="heldMap"
            stock-label="given"
            :big-step="0"
          />
        </template>
      </template>
      <p v-else class="flow-muted">
        They hold no jars. You can still record money collected.
      </p>

      <section class="flow-uses" aria-label="Check-in summary">
        <p v-if="preview.invalid" class="flow-uses__warn">
          Shelf plus damaged is more than they were given. Check the counts.
        </p>
        <p v-if="unpriced.length" class="flow-uses__warn">
          No selling price for {{ unpriced.join(', ') }}. Set it in Catalogue
          settings first.
        </p>
        <p class="flow-total">
          <span>Sold since last visit</span>
          <span class="tabular-nums"
            >{{ preview.soldJars }} jars ·
            {{ formatMoney(preview.soldValue) }}</span
          >
        </p>
        <p v-if="owed(retailer.id) > 0" class="flow-total">
          <span>Owed before today</span>
          <span class="tabular-nums">{{ formatMoney(owed(retailer.id)) }}</span>
        </p>
        <q-input
          v-model.number="collected"
          outlined
          type="number"
          inputmode="numeric"
          min="0"
          label="Money collected now (UGX)"
          data-checkin-collected
        />
        <p class="flow-total">
          <span>They will still owe</span>
          <span class="flow-total__value tabular-nums">{{
            formatMoney(stillOwed)
          }}</span>
        </p>
      </section>
    </template>
  </FlowDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import FlowDialog from './FlowDialog.vue'
import JarPicker from './JarPicker.vue'
import ScanBar from './ScanBar.vue'
import { useFlowWrite } from '@/composables/useFlowWrite'
import { formatMoney } from '@/lib/format'
import {
  checkinPreview,
  findVariantByCode,
  holdingsFor,
  jarLabel
} from '@/lib/simpleOps'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  variants: { type: Array, default: () => [] },
  retailers: { type: Array, default: () => [] },
  holdings: { type: Array, default: () => [] },
  balances: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'saved'])

const write = useFlowWrite('retailer-checkins')
const picker = ref(null)
const retailerId = ref(null)
const shelf = ref({})
const damaged = ref({})
const showDamaged = ref(false)
const collected = ref(null)
const feedback = ref(null)
let scanCounting = false

const owed = id =>
  Math.max(
    0,
    Number(
      props.balances.find(b => Number(b.retailer_id) === Number(id))
        ?.outstanding_amount
    ) || 0
  )
const heldTotal = id =>
  Object.values(holdingsFor(id, props.holdings)).reduce(
    (sum, h) => sum + h.quantity,
    0
  )
const candidates = computed(() =>
  props.retailers.filter(r => heldTotal(r.id) > 0 || owed(r.id) > 0)
)
const retailer = computed(() =>
  props.retailers.find(r => Number(r.id) === retailerId.value)
)
const held = computed(() =>
  retailerId.value ? holdingsFor(retailerId.value, props.holdings) : {}
)
const heldMap = computed(() =>
  Object.fromEntries(
    Object.entries(held.value).map(([id, h]) => [id, h.quantity])
  )
)
const heldVariants = computed(() =>
  props.variants.filter(v => held.value[Number(v.id)])
)
const preview = computed(() =>
  checkinPreview(
    held.value,
    shelf.value,
    showDamaged.value ? damaged.value : {}
  )
)
const unpriced = computed(() =>
  preview.value.lines
    .filter(
      line => line.sold > 0 && held.value[line.variantId].unitPrice === null
    )
    .map(line =>
      jarLabel(props.variants.find(v => Number(v.id) === line.variantId))
    )
)
const stillOwed = computed(() =>
  Math.max(
    0,
    owed(retailerId.value) +
      preview.value.soldValue -
      (Number(collected.value) || 0)
  )
)
const changed = computed(() =>
  preview.value.lines.some(line => line.sold > 0 || line.damaged > 0)
)
const canSubmit = computed(
  () =>
    Boolean(retailer.value) &&
    !preview.value.invalid &&
    unpriced.value.length === 0 &&
    (changed.value || Number(collected.value) > 0)
)
const primaryLabel = 'Save check-in'

function choose(id) {
  retailerId.value = Number(id)
  // Start from "nothing sold": the shelf holds everything they were given.
  shelf.value = { ...heldMap.value }
  damaged.value = {}
  showDamaged.value = false
  collected.value = null
  feedback.value = null
  scanCounting = false
}

function start() {
  write.reset()
  retailerId.value = null
  if (candidates.value.length === 1) choose(candidates.value[0].id)
}
watch(
  () => props.modelValue,
  open => {
    if (open && !write.retryable.value) start()
  }
)

// Scanning counts the shelf from zero: scan every jar still on the shelf.
function onScan(code) {
  const variant = findVariantByCode(heldVariants.value, code)
  if (!variant) {
    feedback.value = {
      tone: 'warning',
      text: `Barcode ${code} is not one of their products.`
    }
    return
  }
  if (!scanCounting) {
    shelf.value = {}
    scanCounting = true
  }
  const current = Number(shelf.value[variant.id]) || 0
  if (current >= (heldMap.value[variant.id] ?? 0)) {
    feedback.value = {
      tone: 'warning',
      text: `They were only given ${current} ${jarLabel(variant)}.`
    }
    return
  }
  shelf.value = { ...shelf.value, [variant.id]: current + 1 }
  picker.value?.flash(variant.id)
  feedback.value = {
    tone: 'success',
    text: `✓ ${jarLabel(variant)} on shelf — ${current + 1}`
  }
}

async function submit() {
  const name = retailer.value.retailer_name
  const { soldJars, soldValue } = preview.value
  const amount = Number(collected.value) || 0
  const remaining = stillOwed.value
  const result = await write.submit(
    {
      retailerId: retailerId.value,
      checkedAt: new Date().toISOString(),
      notes: null,
      counts: preview.value.lines.map(line => ({
        variant_id: line.variantId,
        remaining: line.remaining,
        damaged: line.damaged
      })),
      amount: amount > 0 ? String(Math.round(amount)) : null,
      paymentReference: null
    },
    () => ({
      title: `${name} checked in`,
      lines: [
        `${soldJars} jars sold · ${formatMoney(soldValue)}`,
        amount > 0 ? `Collected ${formatMoney(amount)}` : 'No money collected',
        `Still owes ${formatMoney(remaining)}`
      ]
    })
  )
  if (result) emit('saved')
}
</script>

<style scoped src="./flow.css"></style>
