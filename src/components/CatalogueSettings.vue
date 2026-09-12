<template>
  <q-card flat class="surface-card q-mt-lg"
    ><q-card-section>
      <h2 class="section-title">Variant prices and recipe defaults</h2>
      <p
        >One selling price per variant, with an effective date. Recorded
        reconciliations keep their original price.</p
      >
      <q-banner v-if="error" class="bg-orange-1" role="alert">{{
        error
      }}</q-banner>
      <q-linear-progress v-if="loading" indeterminate />
      <q-expansion-item
        label="Set a variant price"
        default-opened
        expand-separator
      >
        <WriteStatus action="prices" @saved="load" />
        <q-form @submit="savePrice" class="q-gutter-md q-py-md">
          <q-select
            v-model="price.variantId"
            outlined
            emit-value
            map-options
            behavior="dialog"
            :options="variants"
            :disable="locked('prices')"
            :rules="[required]"
            label="Variant"
          />
          <q-input
            v-model="price.unitPrice"
            outlined
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
            type="date"
            :disable="locked('prices')"
            :rules="[required]"
            label="Effective from"
          />
          <q-btn
            type="submit"
            color="primary"
            no-caps
            label="Save price"
            :disable="locked('prices')"
          />
        </q-form>
        <ReportList :rows="priceHistory" :columns="priceColumns" />
      </q-expansion-item>
      <q-expansion-item label="Production recipe defaults" expand-separator>
        <WriteStatus action="recipes" @saved="load" />
        <q-form @submit="saveRecipe" class="q-gutter-md q-py-md">
          <q-select
            v-model="recipe.variantId"
            outlined
            emit-value
            map-options
            behavior="dialog"
            :options="variants"
            :disable="locked('recipes')"
            :rules="[required]"
            label="Variant"
            @update:model-value="selectRecipe"
          />
          <q-input
            v-model="recipe.name"
            outlined
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
              emit-value
              map-options
              behavior="dialog"
              :options="materials"
              :disable="locked('recipes')"
              :rules="[required]"
              label="Material"
            />
            <q-input
              v-model="item.quantityPerUnit"
              outlined
              type="number"
              inputmode="decimal"
              min="0.000001"
              step="0.000001"
              :disable="locked('recipes')"
              :rules="[positive]"
              label="Quantity per jar"
              hint="In the material's unit (kg or pieces). Actual batch quantities remain editable."
            />
            <q-btn
              v-if="recipe.items.length > 1"
              flat
              icon="delete"
              label="Remove material"
              no-caps
              :disable="locked('recipes')"
              @click="recipe.items.splice(index, 1)"
            />
          </article>
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
            label="Save recipe"
            :disable="locked('recipes')"
          />
        </q-form>
      </q-expansion-item> </q-card-section
  ></q-card>
</template>
<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { apiRequest } from '@/lib/api'
import { isWriteLocked, writeAction } from '@/services/writes'
import { required, positive, nonnegative } from '@/lib/validation'
import WriteStatus from './WriteStatus.vue'
import ReportList from './ReportList.vue'
const workspace = ref({
    variants: [],
    materials: [],
    pricing: [],
    recipes: []
  }),
  error = ref(''),
  loading = ref(true)
const today = new Date().toLocaleDateString('en-CA', {
  timeZone: 'Africa/Kampala'
})
const price = reactive({ variantId: null, unitPrice: '', effectiveOn: today })
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
const locked = action => loading.value || isWriteLocked(action)
async function load() {
  loading.value = true
  try {
    workspace.value = await apiRequest('workspace?name=settings')
    error.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
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
  try {
    await writeAction('recipes', JSON.parse(JSON.stringify(recipe)))
    await load()
  } catch {
    /* WriteStatus shows the failure. */
  }
}
onMounted(load)
</script>
