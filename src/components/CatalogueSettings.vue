<template>
  <div class="catalogue-settings">
    <WorkspaceState
      display="banner"
      skeleton
      :mode="ws.mode.value"
      :error="ws.error.value"
      :last-loaded-at="ws.lastLoadedAt.value"
      retry-label="Retry loading settings"
      @retry="load"
    />

    <div class="catalogue-settings__sections">
      <section class="catalogue-section" aria-labelledby="price-section-title">
        <h2 id="price-section-title" class="section-title"
          >Set a variant price</h2
        >
        <p class="catalogue-section__intro"
          >One selling price per variant, with an effective date. Recorded
          reconciliations keep their original price.</p
        >
        <WriteStatus action="prices" @saved="load" />
        <q-form
          ref="priceFormRef"
          class="q-gutter-md"
          greedy
          no-error-focus
          @submit="savePrice"
          @validation-error="onPriceInvalid"
        >
          <FormErrorSummary ref="priceSummaryRef" :errors="priceErrors" />
          <q-select
            v-model="price.variantId"
            outlined
            for="price-variant"
            emit-value
            map-options
            :behavior="selectBehavior"
            :options="variants"
            :disable="locked('prices')"
            :rules="[required]"
            label="Variant"
          />
          <q-input
            v-model="price.unitPrice"
            outlined
            for="price-amount"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            :disable="locked('prices')"
            :rules="[nonnegative]"
            label="Selling price (UGX)"
          />
          <q-input
            v-model="price.effectiveOn"
            outlined
            for="price-effective"
            type="date"
            :disable="locked('prices')"
            :rules="[required]"
            label="Effective from"
          />
          <div>
            <q-btn
              type="submit"
              color="primary"
              no-caps
              unelevated
              label="Save price"
              :disable="locked('prices')"
            />
          </div>
        </q-form>
        <h3 class="catalogue-section__subtitle">Price history</h3>
        <ReportList :rows="priceHistory" :columns="priceColumns" />
      </section>

      <section class="catalogue-section" aria-labelledby="recipe-section-title">
        <h2 id="recipe-section-title" class="section-title"
          >Production recipe defaults</h2
        >
        <p class="catalogue-section__intro"
          >Default materials per jar, used to prefill new production batches.
          Actual batch quantities remain editable.</p
        >
        <WriteStatus action="recipes" @saved="load" />
        <q-form
          ref="recipeFormRef"
          class="q-gutter-md"
          greedy
          no-error-focus
          @submit="saveRecipe"
          @validation-error="onRecipeInvalid"
        >
          <FormErrorSummary ref="recipeSummaryRef" :errors="recipeErrors" />
          <q-select
            v-model="recipe.variantId"
            outlined
            for="recipe-variant"
            emit-value
            map-options
            :behavior="selectBehavior"
            :options="variants"
            :disable="locked('recipes')"
            :rules="[required]"
            label="Variant"
            @update:model-value="selectRecipe"
          />
          <q-input
            v-model="recipe.name"
            outlined
            for="recipe-name"
            label="Recipe name"
            :disable="locked('recipes')"
            :rules="[required]"
          />
          <article
            v-for="(item, index) in recipe.items"
            :key="index"
            class="line-item-card q-gutter-md"
          >
            <q-select
              v-model="item.materialId"
              outlined
              :for="`recipe-material-${index}`"
              emit-value
              map-options
              :behavior="selectBehavior"
              :options="materials"
              :disable="locked('recipes')"
              :rules="[required]"
              :label="
                recipe.items.length > 1 ? `Material ${index + 1}` : 'Material'
              "
            />
            <q-input
              v-model="item.quantityPerUnit"
              outlined
              :for="`recipe-quantity-${index}`"
              type="number"
              inputmode="decimal"
              min="0.000001"
              step="0.000001"
              :disable="locked('recipes')"
              :rules="[positive]"
              label="Quantity per jar"
              hint="In the material's unit (kg or pieces)."
            />
            <q-btn
              v-if="recipe.items.length > 1"
              flat
              icon="delete"
              label="Remove material"
              no-caps
              :aria-label="`Remove material ${index + 1}`"
              :disable="locked('recipes')"
              @click="recipe.items.splice(index, 1)"
            />
          </article>
          <div class="catalogue-section__actions">
            <q-btn
              flat
              no-caps
              icon="add"
              label="Add material"
              :disable="locked('recipes')"
              @click="
                recipe.items.push({ materialId: null, quantityPerUnit: '' })
              "
            />
            <q-btn
              type="submit"
              color="primary"
              no-caps
              unelevated
              label="Save recipe"
              :disable="locked('recipes')"
            />
          </div>
        </q-form>
      </section>
    </div>
  </div>
</template>
<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { apiRequest } from '@/lib/api'
import { isWriteLocked, writeAction } from '@/services/writes'
import { required, positive, nonnegative } from '@/lib/validation'
import { getTodayString } from '@/lib/format'
import { useWorkspace } from '@/composables/useWorkspace'
import { collectFieldErrors, useFormErrors } from '@/composables/useFormErrors'
import FormErrorSummary from './FormErrorSummary.vue'
import WorkspaceState from './WorkspaceState.vue'
import WriteStatus from './WriteStatus.vue'
import ReportList from './ReportList.vue'

const $q = useQuasar()
// MF-17: touch-friendly dialog pickers on phones, keyboard menus elsewhere.
const selectBehavior = computed(() => ($q.screen.lt.sm ? 'dialog' : 'menu'))
const emptySettings = () => ({
  variants: [],
  materials: [],
  pricing: [],
  recipes: []
})
const ws = useWorkspace(
  ({ signal }) => apiRequest('workspace?name=settings', { signal }),
  { initialData: emptySettings() }
)
const workspace = computed(() => ws.data.value ?? emptySettings())
const load = () => ws.load()

const priceFormRef = ref(null)
const recipeFormRef = ref(null)
const {
  errors: priceErrors,
  summaryRef: priceSummaryRef,
  fail: failPrice,
  clear: clearPriceErrors
} = useFormErrors()
const {
  errors: recipeErrors,
  summaryRef: recipeSummaryRef,
  fail: failRecipe,
  clear: clearRecipeErrors
} = useFormErrors()

const price = reactive({
  variantId: null,
  unitPrice: '',
  effectiveOn: getTodayString()
})
const recipe = reactive({
  variantId: null,
  name: '',
  items: [{ materialId: null, quantityPerUnit: '' }]
})
const variants = computed(() =>
  workspace.value.variants.map(v => ({
    value: v.id,
    label: `${v.sku} / ${v.variant_name}`
  }))
)
const materials = computed(() =>
  workspace.value.materials.map(m => ({
    value: m.id,
    label: `${m.name} (${m.unit_of_measure})`
  }))
)
const priceHistory = computed(() =>
  workspace.value.pricing.map(p => ({
    ...p,
    variant: workspace.value.variants.find(v => v.id === p.variant_id)
      ?.variant_name
  }))
)
const priceColumns = [
  { name: 'variant', field: 'variant', label: 'Variant' },
  { name: 'unit_price', field: 'unit_price', label: 'Price', money: true },
  {
    name: 'effective_from',
    field: 'effective_from',
    label: 'Effective from',
    date: true
  }
]
const locked = action => ws.isLoading.value || isWriteLocked(action)
async function onPriceInvalid() {
  await nextTick()
  await failPrice(collectFieldErrors(priceFormRef))
}
async function onRecipeInvalid() {
  await nextTick()
  await failRecipe(collectFieldErrors(recipeFormRef))
}
function selectRecipe() {
  const saved = workspace.value.recipes.find(
    r => r.variant_id === recipe.variantId
  )
  recipe.name = saved?.name ?? ''
  recipe.items = saved?.items.map(i => ({
    materialId: i.material_id,
    quantityPerUnit: i.quantity_per_unit
  })) ?? [{ materialId: null, quantityPerUnit: '' }]
}
async function savePrice() {
  if (locked('prices')) return
  clearPriceErrors()
  try {
    await writeAction('prices', {
      variantId: price.variantId,
      unitPrice: price.unitPrice,
      effectiveFrom: `${price.effectiveOn}T00:00:00+03:00`
    })
    await load()
  } catch {
    /* WriteStatus shows the failure. */
  }
}
async function saveRecipe() {
  if (locked('recipes')) return
  clearRecipeErrors()
  try {
    await writeAction('recipes', JSON.parse(JSON.stringify(recipe)))
    await load()
  } catch {
    /* WriteStatus shows the failure. */
  }
}

defineExpose({ reload: load })
</script>
<style scoped>
.catalogue-settings__sections {
  display: grid;
  gap: var(--boms-space-6);
}
.catalogue-section {
  min-width: 0;
}
.catalogue-section__intro {
  margin: var(--boms-space-1) 0 var(--boms-space-3);
  color: var(--boms-color-text-muted);
}
.catalogue-section__subtitle {
  margin: var(--boms-space-6) 0 var(--boms-space-2);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: normal;
}
.catalogue-section__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--boms-space-2);
}
@media (min-width: 1024px) {
  .catalogue-settings__sections {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}
</style>
