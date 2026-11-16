// Reference data ported unchanged from the hosted Supabase seeder.
export const productSeeds = [
  {
    slug: 'beecone-raw-natural-honey',
    name: 'Beecone Raw Natural Honey',
    description:
      'Core Beecone honey catalogue used for supply, production, and retail traceability.',
    is_active: true
  }
]

export const variantSeeds = [
  {
    product_slug: 'beecone-raw-natural-honey',
    sku: 'BEE-RAW-60',
    variant_name: 'Raw Honey 60g',
    flavor: 'Classic',
    pack_size_grams: 60,
    packaging_type: 'Jar',
    is_active: true
  },
  {
    product_slug: 'beecone-raw-natural-honey',
    sku: 'BEE-RAW-400',
    variant_name: 'Raw Honey 400g',
    flavor: 'Classic',
    pack_size_grams: 400,
    packaging_type: 'Jar',
    is_active: true
  },
  {
    product_slug: 'beecone-raw-natural-honey',
    sku: 'BEE-RAW-1000',
    variant_name: 'Raw Honey 1kg',
    flavor: 'Classic',
    pack_size_grams: 1000,
    packaging_type: 'Jar',
    is_active: true
  },
  {
    product_slug: 'beecone-raw-natural-honey',
    sku: 'BEE-GIN-60',
    variant_name: 'Ginger Infused Honey 60g',
    flavor: 'Ginger Infused',
    pack_size_grams: 60,
    packaging_type: 'Jar',
    is_active: true
  },
  {
    product_slug: 'beecone-raw-natural-honey',
    sku: 'BEE-GIN-400',
    variant_name: 'Ginger Infused Honey 400g',
    flavor: 'Ginger Infused',
    pack_size_grams: 400,
    packaging_type: 'Jar',
    is_active: true
  },
  {
    product_slug: 'beecone-raw-natural-honey',
    sku: 'BEE-GIN-1000',
    variant_name: 'Ginger Infused Honey 1kg',
    flavor: 'Ginger Infused',
    pack_size_grams: 1000,
    packaging_type: 'Jar',
    is_active: true
  }
]

export const materialSeeds = [
  {
    code: 'RAW-HONEY-KG',
    name: 'Raw Honey',
    kind: 'raw_honey',
    unit_of_measure: 'kg',
    description: 'Bulk raw honey, bought in 20 kg jerricans.',
    is_active: true
  },
  {
    code: 'GINGER-POWDER-KG',
    name: 'Ginger Powder',
    kind: 'spice',
    unit_of_measure: 'kg',
    description: '1 kg infuses one 20 kg jerrican of honey.',
    is_active: true
  },
  {
    code: 'JAR-60',
    name: '60g Jar',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Empty 60g jar with lid.',
    is_active: true
  },
  {
    code: 'JAR-400',
    name: '400g Jar',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Empty 400g jar with lid.',
    is_active: true
  },
  {
    code: 'JAR-1000',
    name: '1kg Jar',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Empty 1kg jar with lid.',
    is_active: true
  },
  {
    code: 'LABEL-60',
    name: '60g Label',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Printed label for 60g jars.',
    is_active: true
  },
  {
    code: 'LABEL-400',
    name: '400g Label',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Printed label for 400g jars.',
    is_active: true
  },
  {
    code: 'LABEL-1000',
    name: '1kg Label',
    kind: 'packaging',
    unit_of_measure: 'piece',
    description: 'Printed label for 1kg jars.',
    is_active: true
  }
]

// Default recipes per jar (editable in Catalogue settings). Ginger honey is
// mixed 20 kg honey : 1 kg ginger, so a jar is 20/21 honey and 1/21 ginger.
const per = (grams, share = 1) =>
  (Math.round((grams / 1000) * share * 1e6) / 1e6).toFixed(6)
export const recipeSeeds = [
  {
    sku: 'BEE-RAW-60',
    name: 'Raw Honey 60g',
    items: [
      { material_code: 'RAW-HONEY-KG', quantity_per_unit: per(60) },
      { material_code: 'JAR-60', quantity_per_unit: '1' },
      { material_code: 'LABEL-60', quantity_per_unit: '1' }
    ]
  },
  {
    sku: 'BEE-RAW-400',
    name: 'Raw Honey 400g',
    items: [
      { material_code: 'RAW-HONEY-KG', quantity_per_unit: per(400) },
      { material_code: 'JAR-400', quantity_per_unit: '1' },
      { material_code: 'LABEL-400', quantity_per_unit: '1' }
    ]
  },
  {
    sku: 'BEE-RAW-1000',
    name: 'Raw Honey 1kg',
    items: [
      { material_code: 'RAW-HONEY-KG', quantity_per_unit: per(1000) },
      { material_code: 'JAR-1000', quantity_per_unit: '1' },
      { material_code: 'LABEL-1000', quantity_per_unit: '1' }
    ]
  },
  {
    sku: 'BEE-GIN-60',
    name: 'Ginger Infused Honey 60g',
    items: [
      { material_code: 'RAW-HONEY-KG', quantity_per_unit: per(60, 20 / 21) },
      { material_code: 'GINGER-POWDER-KG', quantity_per_unit: per(60, 1 / 21) },
      { material_code: 'JAR-60', quantity_per_unit: '1' },
      { material_code: 'LABEL-60', quantity_per_unit: '1' }
    ]
  },
  {
    sku: 'BEE-GIN-400',
    name: 'Ginger Infused Honey 400g',
    items: [
      { material_code: 'RAW-HONEY-KG', quantity_per_unit: per(400, 20 / 21) },
      {
        material_code: 'GINGER-POWDER-KG',
        quantity_per_unit: per(400, 1 / 21)
      },
      { material_code: 'JAR-400', quantity_per_unit: '1' },
      { material_code: 'LABEL-400', quantity_per_unit: '1' }
    ]
  },
  {
    sku: 'BEE-GIN-1000',
    name: 'Ginger Infused Honey 1kg',
    items: [
      { material_code: 'RAW-HONEY-KG', quantity_per_unit: per(1000, 20 / 21) },
      {
        material_code: 'GINGER-POWDER-KG',
        quantity_per_unit: per(1000, 1 / 21)
      },
      { material_code: 'JAR-1000', quantity_per_unit: '1' },
      { material_code: 'LABEL-1000', quantity_per_unit: '1' }
    ]
  }
]

export const supplierSeeds = [
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

export const retailerSeeds = [
  {
    retailer_name: 'Ntinda Health Market',
    contact_name: 'Irene Namubiru',
    phone: '+256700200101',
    email: 'orders@ntindahealth.test',
    delivery_location: 'Ntinda, Kampala',
    notes: 'Sample consignment partner for central Kampala replenishment.',
    is_active: true
  },
  {
    retailer_name: 'Entebbe Organics Corner',
    contact_name: 'Paul Ssemanda',
    phone: '+256700200202',
    email: 'stock@entebbeorganics.test',
    delivery_location: 'Entebbe Road, Wakiso',
    notes: 'Sample airport corridor retailer for jar movement demos.',
    is_active: true
  },
  {
    retailer_name: 'Jinja Farmers Shop',
    contact_name: 'Naomi Auma',
    phone: '+256700200303',
    email: 'retail@jinjafarmers.test',
    delivery_location: 'Jinja Main Street',
    notes:
      'Sample upcountry retailer for distribution and reconciliation flows.',
    is_active: true
  }
]
