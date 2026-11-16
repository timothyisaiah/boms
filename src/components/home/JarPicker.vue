<template>
  <div class="jar-picker">
    <section
      v-for="group in groups"
      :key="group.label"
      class="jar-picker__group"
      :aria-label="group.label"
    >
      <h3 class="jar-picker__group-title">{{ group.label }}</h3>
      <div
        v-for="variant in group.items"
        :key="variant.id"
        class="jar-picker__row"
        :class="{
          'jar-picker__row--active': count(variant) > 0,
          'jar-picker__row--flash': flashId === Number(variant.id)
        }"
        :data-variant="variant.sku"
      >
        <div class="jar-picker__info">
          <div class="jar-picker__size">
            {{ sizeLabel(variant.pack_size_grams) }}
          </div>
          <div class="jar-picker__hint">
            <span v-if="limits"> {{ limitOf(variant) }} {{ stockLabel }} </span>
            <span v-if="showPrice && variant.current_price != null">
              <template v-if="limits"> · </template
              >{{ formatMoney(variant.current_price) }}
            </span>
            <span v-else-if="showPrice" class="jar-picker__warn">
              <template v-if="limits"> · </template>No price set
            </span>
          </div>
        </div>
        <div class="jar-picker__stepper">
          <q-btn
            round
            unelevated
            color="grey-3"
            text-color="brown-10"
            icon="remove"
            :aria-label="`One less ${jarLabel(variant)}`"
            :disable="count(variant) === 0"
            @click="set(variant, count(variant) - 1)"
          />
          <input
            class="jar-picker__input tabular-nums"
            type="number"
            inputmode="numeric"
            min="0"
            :max="limits ? limitOf(variant) : undefined"
            :value="count(variant) || ''"
            placeholder="0"
            :aria-label="`${jarLabel(variant)} jars`"
            @focus="$event.target.select()"
            @input="set(variant, $event.target.value)"
          />
          <q-btn
            round
            unelevated
            color="primary"
            icon="add"
            :aria-label="`One more ${jarLabel(variant)}`"
            :disable="atLimit(variant)"
            @click="set(variant, count(variant) + 1)"
          />
          <q-btn
            v-if="bigStep"
            flat
            dense
            no-caps
            color="primary"
            :label="`+${bigStep}`"
            class="jar-picker__big"
            :aria-label="`${bigStep} more ${jarLabel(variant)}`"
            :disable="atLimit(variant)"
            @click="set(variant, count(variant) + bigStep)"
          />
        </div>
      </div>
    </section>
    <p v-if="!groups.length" class="jar-picker__empty">
      No products are set up yet. Add them in Catalogue settings.
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatMoney } from '@/lib/format'
import { groupVariants, jarLabel, sizeLabel } from '@/lib/simpleOps'

const props = defineProps({
  variants: { type: Array, default: () => [] },
  /** `{ [variantId]: quantity }` */
  modelValue: { type: Object, default: () => ({}) },
  /** Optional `{ [variantId]: max }`; caps the stepper and shows the count. */
  limits: { type: Object, default: null },
  stockLabel: { type: String, default: 'in store' },
  showPrice: { type: Boolean, default: false },
  bigStep: { type: Number, default: 10 }
})
const emit = defineEmits(['update:modelValue'])

const groups = computed(() => groupVariants(props.variants))
const flashId = ref(null)
let flashTimer

const count = variant => Number(props.modelValue?.[variant.id]) || 0
const limitOf = variant => Number(props.limits?.[variant.id]) || 0
const atLimit = variant =>
  props.limits ? count(variant) >= limitOf(variant) : false

function set(variant, value) {
  let next = Math.max(0, Math.trunc(Number(value) || 0))
  if (props.limits) next = Math.min(next, limitOf(variant))
  emit('update:modelValue', { ...props.modelValue, [variant.id]: next })
}

/** Briefly highlight a row (after a scan) so the change is visible. */
function flash(variantId) {
  flashId.value = Number(variantId)
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flashId.value = null), 900)
}
defineExpose({ flash })
</script>

<style scoped>
.jar-picker {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-4);
}
.jar-picker__group {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
}
.jar-picker__group-title {
  margin: 0;
  font-size: var(--boms-font-size-label);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--boms-color-text-muted);
}
.jar-picker__row {
  display: flex;
  align-items: center;
  gap: var(--boms-space-3);
  padding: var(--boms-space-2) var(--boms-space-3);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface);
  transition: background-color 0.3s;
}
.jar-picker__row--active {
  border-color: var(--boms-color-border-strong);
  background: var(--boms-color-selected-bg);
}
.jar-picker__row--flash {
  background: var(--boms-color-success-bg);
}
.jar-picker__info {
  flex: 1;
  min-width: 0;
}
.jar-picker__size {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--boms-color-heading);
}
.jar-picker__hint {
  font-size: var(--boms-font-size-caption);
  color: var(--boms-color-text-muted);
}
.jar-picker__warn {
  color: var(--boms-color-danger-text);
}
.jar-picker__stepper {
  display: flex;
  align-items: center;
  gap: var(--boms-space-1);
}
.jar-picker__input {
  width: 3.5rem;
  height: 2.75rem;
  text-align: center;
  font: inherit;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--boms-color-text);
  background: var(--boms-color-surface);
  border: 1px solid var(--boms-color-border-strong);
  border-radius: var(--boms-radius-sm);
  appearance: textfield;
  -moz-appearance: textfield;
}
.jar-picker__input::-webkit-inner-spin-button,
.jar-picker__input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.jar-picker__input:focus-visible {
  outline: 2px solid var(--boms-color-focus);
  outline-offset: 1px;
}
.jar-picker__big {
  min-width: 2.75rem;
}
.jar-picker__empty {
  margin: 0;
  color: var(--boms-color-text-muted);
}
@media (max-width: 380px) {
  .jar-picker__big {
    display: none;
  }
}
</style>
