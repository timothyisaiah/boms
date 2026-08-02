import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { loadLocalEnvFiles, resolveMode } from './env.mjs'

const selectedMode = resolveMode()

loadLocalEnvFiles(selectedMode)

const supabaseUrl =
  process.env.SUPABASE_URL?.trim() ??
  process.env.VITE_SUPABASE_URL?.trim() ??
  ''
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? ''

const productSeeds = [
  {
    slug: 'beecone-raw-natural-honey',
    name: 'Beecone Raw Natural Honey',
    description:
      'Core Beecone honey catalogue used for supply, production, and retail traceability.',
    is_active: true
  }
]

const variantSeeds = [
  {
    product_slug: 'beecone-raw-natural-honey',
    sku: 'BEE-RAW-250',
    variant_name: '250g Classic Jar',
    flavor: 'Classic',
    pack_size_grams: 250,
    packaging_type: 'Jar',
    is_active: true
  },
  {
    product_slug: 'beecone-raw-natural-honey',
    sku: 'BEE-RAW-500',
    variant_name: '500g Classic Jar',
    flavor: 'Classic',
    pack_size_grams: 500,
    packaging_type: 'Jar',
    is_active: true
  },
  {
    product_slug: 'beecone-raw-natural-honey',
    sku: 'BEE-RAW-1000',
    variant_name: '1kg Classic Jar',
    flavor: 'Classic',
    pack_size_grams: 1000,
    packaging_type: 'Jar',
    is_active: true
  },
  {
    product_slug: 'beecone-raw-natural-honey',
    sku: 'BEE-GIN-500',
    variant_name: '500g Ginger Infused Jar',
    flavor: 'Ginger Infused',
    pack_size_grams: 500,
    packaging_type: 'Jar',
    is_active: true
  }
]

const materialSeeds = [
  {
    code: 'RAW-HONEY-KG',
    name: 'Raw Honey',
    kind: 'raw_honey',
    unit_of_measure: 'kg',
    description: 'Primary honey input measured by kilogram.',
    is_active: true
  },
  {
    code: 'JAR-250',
    name: '250g PET Jar',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Primary 250g jar used for finished stock.',
    is_active: true
  },
  {
    code: 'JAR-500',
    name: '500g PET Jar',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Primary 500g jar used for finished stock.',
    is_active: true
  },
  {
    code: 'JAR-1000',
    name: '1kg PET Jar',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Primary 1kg jar used for finished stock.',
    is_active: true
  },
  {
    code: 'LID-63MM',
    name: '63mm Gold Twist Lid',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Shared lid used across Beecone jar formats.',
    is_active: true
  },
  {
    code: 'LABEL-FRONT',
    name: 'Beecone Front Label',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Printed front label applied to finished jars.',
    is_active: true
  },
  {
    code: 'SEAL-TAMPER',
    name: 'Tamper Seal',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Tamper-evident seal for traceable retail stock.',
    is_active: true
  },
  {
    code: 'CARTON-12',
    name: '12-Jar Master Carton',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Outer carton for warehouse handling and retail dispatch.',
    is_active: true
  }
]

const supplierSeeds = [
  {
    supplier_name: 'Kayunga Honey Cooperative',
    supplier_kind: 'raw_honey',
    contact_name: 'Samuel Kintu',
    phone: '+256700100101',
    email: 'procurement@kayungahoney.test',
    notes: 'Sample raw honey source for local development and workflow demos.',
    is_active: true
  },
  {
    supplier_name: 'Kampala Pack House',
    supplier_kind: 'packaging',
    contact_name: 'Ruth Nansubuga',
    phone: '+256700100202',
    email: 'sales@kampalapackhouse.test',
    notes: 'Primary sample supplier for PET jars and lids.',
    is_active: true
  },
  {
    supplier_name: 'Nile Print and Label',
    supplier_kind: 'packaging',
    contact_name: 'Martin Ouma',
    phone: '+256700100303',
    email: 'orders@nileprint.test',
    notes: 'Sample label and tamper seal supplier.',
    is_active: true
  },
  {
    supplier_name: 'Beecone Mixed Inputs Depot',
    supplier_kind: 'mixed',
    contact_name: 'Grace Achieng',
    phone: '+256700100404',
    email: 'ops@mixedinputs.test',
    notes:
      'Fallback sample supplier that can provide both honey and packaging.',
    is_active: true
  }
]

if (!supabaseUrl || !supabaseSecretKey) {
  console.error(
    `Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY. The script reads .env files automatically for mode "${selectedMode}".`
  )
  process.exit(1)
}

if (
  supabaseSecretKey.startsWith('sb_publishable_') ||
  supabaseSecretKey.startsWith('eyJ')
) {
  console.error(
    'SUPABASE_SECRET_KEY must be a server-side secret key, not the publishable client key.'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
})

function normalizeName(value) {
  return value.trim().toLowerCase()
}

async function upsertProducts() {
  const { error } = await supabase
    .from('products')
    .upsert(productSeeds, { onConflict: 'slug' })

  if (error) {
    throw error
  }

  const { data, error: selectError } = await supabase
    .from('products')
    .select('id, slug')
    .in(
      'slug',
      productSeeds.map(product => product.slug)
    )

  if (selectError) {
    throw selectError
  }

  return new Map((data ?? []).map(product => [product.slug, product.id]))
}

async function upsertVariants(productIdBySlug) {
  const payload = variantSeeds.map(variant => ({
    product_id: productIdBySlug.get(variant.product_slug),
    sku: variant.sku,
    variant_name: variant.variant_name,
    flavor: variant.flavor,
    pack_size_grams: variant.pack_size_grams,
    packaging_type: variant.packaging_type,
    is_active: variant.is_active
  }))

  if (payload.some(variant => !variant.product_id)) {
    throw new Error('Unable to resolve seeded product IDs for variants.')
  }

  const { error } = await supabase
    .from('product_variants')
    .upsert(payload, { onConflict: 'sku' })

  if (error) {
    throw error
  }
}

async function upsertMaterials() {
  const { error } = await supabase
    .from('materials')
    .upsert(materialSeeds, { onConflict: 'code' })

  if (error) {
    throw error
  }
}

async function upsertSuppliers() {
  const { data: existingSuppliers, error: selectError } = await supabase
    .from('suppliers')
    .select('id, supplier_name')

  if (selectError) {
    throw selectError
  }

  const supplierIdByName = new Map(
    (existingSuppliers ?? []).map(supplier => [
      normalizeName(supplier.supplier_name),
      supplier.id
    ])
  )

  const suppliersToUpdate = supplierSeeds
    .filter(supplier =>
      supplierIdByName.has(normalizeName(supplier.supplier_name))
    )
    .map(supplier => ({
      id: supplierIdByName.get(normalizeName(supplier.supplier_name)),
      ...supplier
    }))

  const suppliersToInsert = supplierSeeds.filter(
    supplier => !supplierIdByName.has(normalizeName(supplier.supplier_name))
  )

  if (suppliersToUpdate.length > 0) {
    const { error: updateError } = await supabase
      .from('suppliers')
      .upsert(suppliersToUpdate, { onConflict: 'id' })

    if (updateError) {
      throw updateError
    }
  }

  if (suppliersToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('suppliers')
      .insert(suppliersToInsert)

    if (insertError) {
      throw insertError
    }
  }
}

async function seedReferenceData() {
  const productIdBySlug = await upsertProducts()

  await upsertVariants(productIdBySlug)
  await upsertMaterials()
  await upsertSuppliers()

  console.log(
    `Seeded ${productSeeds.length} products, ${variantSeeds.length} variants, ${materialSeeds.length} materials, and ${supplierSeeds.length} suppliers into ${supabaseUrl}.`
  )
}

seedReferenceData().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
