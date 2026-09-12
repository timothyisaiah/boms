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

export const materialSeeds = [
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
