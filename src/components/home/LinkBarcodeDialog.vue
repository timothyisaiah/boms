<template>
  <q-dialog :model-value="Boolean(code)" @update:model-value="onToggle">
    <q-card class="link-barcode">
      <q-card-section>
        <h2 class="link-barcode__title">New barcode {{ code }}</h2>
        <p v-if="canLink" class="flow-muted">
          Which product carries this barcode? Every jar of that product will
          scan from now on.
        </p>
        <p v-else class="flow-muted">
          This barcode is not linked to a product. Ask the owner or operations
          manager to scan it once and link it.
        </p>
      </q-card-section>
      <q-card-section v-if="canLink" class="flow-choice">
        <button
          v-for="variant in variants"
          :key="variant.id"
          type="button"
          class="flow-choice__item"
          :class="{ 'flow-choice__item--selected': selected === variant.id }"
          @click="selected = variant.id"
        >
          <span class="flow-choice__name">{{ jarLabel(variant) }}</span>
          <span v-if="variant.barcode" class="flow-choice__hint">
            replaces {{ variant.barcode }}
          </span>
        </button>
      </q-card-section>
      <q-card-section v-if="error" class="link-barcode__error" role="alert">
        {{ error }}
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancel" @click="emit('cancel')" />
        <q-btn
          v-if="canLink"
          unelevated
          no-caps
          color="primary"
          label="Link barcode"
          :disable="!selected"
          :loading="saving"
          @click="save"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { writeAction } from '@/services/writes'
import { jarLabel } from '@/lib/simpleOps'

const props = defineProps({
  code: { type: String, default: '' },
  variants: { type: Array, default: () => [] },
  canLink: { type: Boolean, default: false }
})
const emit = defineEmits(['linked', 'cancel'])
const selected = ref(null)
const saving = ref(false)
const error = ref('')

watch(
  () => props.code,
  () => {
    selected.value = null
    error.value = ''
  }
)

function onToggle(open) {
  if (!open) emit('cancel')
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    await writeAction('variant-barcode', {
      variantId: selected.value,
      barcode: props.code
    })
    emit('linked', selected.value, props.code)
  } catch (cause) {
    error.value = cause?.message || 'The barcode could not be linked.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped src="./flow.css"></style>
<style scoped>
.link-barcode {
  width: min(480px, 100vw);
}
.link-barcode__title {
  margin: 0 0 var(--boms-space-2);
  font-size: var(--boms-font-size-section-title);
  font-weight: 800;
  color: var(--boms-color-heading);
}
.link-barcode__error {
  color: var(--boms-color-danger-text);
}
</style>
