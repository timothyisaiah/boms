<template>
  <FlowDialog
    :model-value="modelValue"
    flow="make"
    title="Make jars"
    icon="science"
    :primary-label="primaryLabel"
    primary-icon="bolt"
    :primary-disabled="!canSubmit"
    :submitting="write.submitting.value"
    :error="write.error.value"
    :retryable="write.retryable.value"
    :done="write.done.value"
    again-label="Make more"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="submit"
    @retry="write.retry"
    @again="start"
  >
    <p class="flow-lead">How many jars did you fill?</p>
    <JarPicker v-model="counts" :variants="variants" :big-step="10" />

    <section
      v-if="jars > 0"
      class="flow-uses"
      aria-labelledby="make-uses-title"
      data-make-uses
    >
      <h3 id="make-uses-title" class="flow-uses__title">This will use</h3>
      <p
        v-for="variant in requirements.missingRecipes"
        :key="variant.id"
        class="flow-uses__warn"
      >
        No recipe for {{ jarLabel(variant) }}. Ask the owner to add one in
        Catalogue settings.
      </p>
      <ul class="flow-uses__list">
        <li
          v-for="line in requirements.lines"
          :key="line.material.id"
          class="flow-uses__line"
          :class="{ 'flow-uses__line--short': line.short }"
        >
          <q-icon
            :name="line.short ? 'warning' : 'check_circle'"
            :class="
              line.short ? 'flow-uses__icon--short' : 'flow-uses__icon--ok'
            "
            size="20px"
          />
          <span class="flow-uses__name">{{ line.material.name }}</span>
          <span class="flow-uses__amount tabular-nums">
            {{ formatMaterialAmount(line.material, line.needed) }}
          </span>
          <span v-if="line.short" class="flow-uses__have">
            only {{ formatMaterialAmount(line.material, line.onHand) }} in stock
          </span>
        </li>
      </ul>
    </section>
  </FlowDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import FlowDialog from './FlowDialog.vue'
import JarPicker from './JarPicker.vue'
import { useFlowWrite } from '@/composables/useFlowWrite'
import {
  computeRequirements,
  countsToItems,
  formatMaterialAmount,
  jarLabel,
  totalJars
} from '@/lib/simpleOps'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  variants: { type: Array, default: () => [] },
  recipes: { type: Array, default: () => [] },
  materials: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'saved'])

const counts = ref({})
const write = useFlowWrite('production-run')
const jars = computed(() => totalJars(counts.value))
const requirements = computed(() =>
  computeRequirements(
    counts.value,
    props.recipes,
    props.materials,
    props.variants
  )
)
const canSubmit = computed(
  () =>
    jars.value > 0 &&
    requirements.value.missingRecipes.length === 0 &&
    !requirements.value.lines.some(line => line.short)
)
const primaryLabel = computed(() =>
  jars.value
    ? `Make ${jars.value} ${jars.value === 1 ? 'jar' : 'jars'}`
    : 'Make jars'
)

function start() {
  counts.value = {}
  write.reset()
}
watch(
  () => props.modelValue,
  open => {
    if (open && !write.retryable.value) start()
  }
)

async function submit() {
  const items = countsToItems(counts.value)
  const byId = new Map(props.variants.map(v => [Number(v.id), v]))
  const made = jars.value
  const result = await write.submit(
    { producedAt: new Date().toISOString(), notes: null, items },
    () => ({
      title: `${made} ${made === 1 ? 'jar' : 'jars'} made`,
      lines: [
        ...items.map(
          item => `${item.quantity} × ${jarLabel(byId.get(item.variant_id))}`
        ),
        'Supplies used and costs were recorded automatically.'
      ]
    })
  )
  if (result) emit('saved')
}
</script>

<style scoped src="./flow.css"></style>
