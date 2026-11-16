<template>
  <article
    class="rec-line"
    :class="`rec-line--${accounting.state}`"
    :aria-labelledby="headingId"
    :data-line-key="line.key"
  >
    <div class="rec-line__header">
      <h3 :id="headingId" class="rec-line__title">Line {{ index + 1 }}</h3>
      <q-btn
        v-if="removable"
        flat
        round
        dense
        type="button"
        color="negative"
        icon="delete"
        class="rec-line__remove"
        :aria-label="`Remove line ${index + 1}`"
        :disable="disabled"
        @click="emit('remove')"
      />
    </div>

    <div class="rec-line__grid rec-line__grid--two">
      <q-select
        v-model="line.stockIssueItemId"
        :for="fieldId('line')"
        outlined
        :behavior="selectBehavior"
        lazy-rules
        :rules="[required]"
        emit-value
        map-options
        :disable="disabled || options.length === 0"
        :options="options"
        label="Issued stock line"
        @update:model-value="emit('select')"
      />

      <q-input
        :model-value="priceText"
        :for="fieldId('price')"
        outlined
        readonly
        label="Variant price on reconciliation date"
        hint="Only sold jars create a payment obligation."
      />
    </div>

    <p v-if="openLine" class="rec-line__context">
      {{ openLine.sku ?? 'Variant' }} / {{ openLine.batch_code ?? 'Batch' }} /
      {{ formatQuantity(openLine.quantity_open) }} jars open at
      {{ formatMoney(openLine.unit_cost) }} cost per jar
    </p>

    <fieldset class="rec-line__counts">
      <legend class="rec-line__legend">
        Where the open jars went
        <span class="rec-line__legend-hint"
          >Sold + returned + damaged + expired + remaining must equal the open
          quantity.</span
        >
      </legend>
      <div class="rec-line__grid">
        <q-input
          v-model="line.quantitySold"
          :for="fieldId('quantitySold')"
          outlined
          type="number"
          inputmode="numeric"
          lazy-rules
          :rules="[nonnegative, whole]"
          min="0"
          step="1"
          :disable="disabled"
          label="Sold"
        />
        <q-input
          v-model="line.quantityReturned"
          :for="fieldId('quantityReturned')"
          outlined
          type="number"
          inputmode="numeric"
          lazy-rules
          :rules="[v => v === '' || nonnegative(v), whole]"
          min="0"
          step="1"
          :disable="disabled"
          label="Returned"
        />
        <q-input
          v-model="line.quantityDamaged"
          :for="fieldId('quantityDamaged')"
          outlined
          type="number"
          inputmode="numeric"
          lazy-rules
          :rules="[v => v === '' || nonnegative(v), whole]"
          min="0"
          step="1"
          :disable="disabled"
          label="Damaged"
        />
        <q-input
          v-model="line.quantityExpired"
          :for="fieldId('quantityExpired')"
          outlined
          type="number"
          inputmode="numeric"
          min="0"
          step="1"
          lazy-rules
          :rules="[v => v === '' || nonnegative(v), whole]"
          :disable="disabled"
          label="Expired"
        />
        <q-input
          v-model="line.quantityRemaining"
          :for="fieldId('quantityRemaining')"
          outlined
          type="number"
          inputmode="numeric"
          lazy-rules
          :rules="[nonnegative, whole]"
          min="0"
          step="1"
          :disable="disabled"
          label="Remaining"
          hint="Still on the retailer's shelf"
        />
        <q-input
          v-model="line.returnReason"
          :for="fieldId('returnReason')"
          outlined
          :disable="disabled"
          label="Return / loss reason"
          :rules="[
            v =>
              !(
                Number(line.quantityReturned) +
                Number(line.quantityDamaged) +
                Number(line.quantityExpired)
              ) || required(v)
          ]"
          hint="Good returns are restocked; damaged and expired stock is written off."
        />
      </div>
    </fieldset>

    <div
      class="rec-line__accounting"
      :class="`rec-line__accounting--${accounting.state}`"
      :data-accounting-state="accounting.state"
    >
      <dl v-if="accounting.opening !== null" class="rec-line__equation">
        <div class="rec-line__term">
          <dt>Open</dt>
          <dd data-accounting="opening">{{
            formatQuantity(accounting.opening)
          }}</dd>
        </div>
        <div class="rec-line__term">
          <dt>Accounted</dt>
          <dd data-accounting="accounted">{{
            formatQuantity(accounting.accounted)
          }}</dd>
        </div>
        <div class="rec-line__term rec-line__term--result">
          <dt>{{ accounting.state === 'over' ? 'Over by' : 'Unaccounted' }}</dt>
          <dd data-accounting="unaccounted">{{
            formatQuantity(Math.abs(accounting.unaccounted))
          }}</dd>
        </div>
      </dl>
      <p class="rec-line__status" role="status">
        <q-icon :name="statusIcon" size="20px" aria-hidden="true" />
        <span>{{ statusText }}</span>
      </p>
      <p v-if="openLine && price != null" class="rec-line__value">
        Payment due on sold jars:
        <strong class="tabular-nums">{{ formatMoney(soldValue) }}</strong>
      </p>
    </div>
  </article>
</template>

<script setup>
import { computed, useId } from 'vue'
import { required, nonnegative, whole } from '@/lib/validation'
import { asNumber, formatMoney, formatQuantity } from '@/lib/format'
import {
  describeAccounting,
  lineAccounting,
  lineFieldId
} from '@/components/finance/financeDomain'

const props = defineProps({
  /** The reactive line object owned by the reconciliation form. */
  line: { type: Object, required: true },
  index: { type: Number, required: true },
  /** Open issue line for the selected stock line (null when unknown). */
  openLine: { type: Object, default: null },
  /** Price effective on the reconciliation date (read-only). */
  price: { type: [Number, String], default: null },
  options: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  removable: { type: Boolean, default: false },
  selectBehavior: { type: String, default: 'default' }
})
const emit = defineEmits(['remove', 'select'])
const headingId = useId()

const fieldId = field => lineFieldId(props.line, field)
const accounting = computed(() => lineAccounting(props.line, props.openLine))
const statusText = computed(() => describeAccounting(accounting.value))
const statusIcon = computed(
  () =>
    ({
      balanced: 'check_circle',
      under: 'error_outline',
      over: 'report',
      unknown: 'link_off'
    })[accounting.value.state] ?? 'info'
)
const priceText = computed(() =>
  props.price == null ? 'Price not set for this date' : formatMoney(props.price)
)
const soldValue = computed(
  () =>
    Math.max(0, Math.trunc(asNumber(props.line.quantitySold))) *
    Math.max(0, asNumber(props.price))
)
</script>

<style scoped>
.rec-line {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-3);
  padding: var(--boms-space-4);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface);
}
.rec-line__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-2);
}
.rec-line__title {
  margin: 0;
  color: var(--boms-color-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: normal;
}
.rec-line__remove {
  overflow: hidden;
}
.rec-line__grid {
  display: grid;
  gap: var(--boms-space-2) var(--boms-space-3);
  grid-template-columns: 1fr;
}
.rec-line__context {
  margin: 0;
  color: var(--boms-color-text-muted);
  font-size: var(--boms-font-size-caption);
  overflow-wrap: anywhere;
}
.rec-line__counts {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.rec-line__legend {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--boms-space-3);
  padding: 0;
  color: var(--boms-color-heading);
  font-weight: 700;
}
.rec-line__legend-hint {
  color: var(--boms-color-text-muted);
  font-size: var(--boms-font-size-caption);
  font-weight: 400;
}
.rec-line__accounting {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
  padding: var(--boms-space-3);
  border: 1px solid var(--boms-color-border);
  border-left-width: 4px;
  border-radius: var(--boms-radius-sm);
  background: var(--boms-color-surface-subtle);
}
.rec-line__accounting--balanced {
  border-color: var(--boms-color-success);
  background: var(--boms-color-success-bg);
}
.rec-line__accounting--under,
.rec-line__accounting--unknown {
  border-color: var(--boms-color-warning-border);
  background: var(--boms-color-warning-bg);
}
.rec-line__accounting--over {
  border-color: var(--boms-color-danger);
  background: var(--boms-color-danger-bg);
}
.rec-line__equation {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--boms-space-2);
  margin: 0;
}
.rec-line__term {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.rec-line__term dt {
  color: var(--boms-color-text-muted);
  font-size: var(--boms-font-size-caption);
}
.rec-line__term dd {
  margin: 0;
  color: var(--boms-color-heading);
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.rec-line__status {
  display: flex;
  align-items: flex-start;
  gap: var(--boms-space-2);
  margin: 0;
  color: var(--boms-color-text);
  font-weight: 700;
  line-height: 1.4;
}
.rec-line__status :deep(.q-icon) {
  flex: 0 0 auto;
  overflow: hidden;
}
.rec-line--balanced .rec-line__status {
  color: var(--boms-color-success-text);
}
.rec-line--under .rec-line__status,
.rec-line--unknown .rec-line__status {
  color: var(--boms-color-warning-text);
}
.rec-line--over .rec-line__status {
  color: var(--boms-color-danger-text);
}
.rec-line__value {
  margin: 0;
}

@media (min-width: 600px) {
  .rec-line__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1024px) {
  .rec-line__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .rec-line__grid--two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
