// Merge duplicate supply items that are the same physical thing (e.g. "RAW
// Honey" RAW-20 and "Raw Honey" RAW-HONEY-KG, or "60g Sticker" and "60g
// Label"): recipes are repointed to the item that holds stock, and the empty
// duplicate is deactivated. Items with stock or history are never changed.
//
//   node scripts/repair-recipe-materials.mjs [--mode production]          preview
//   node scripts/repair-recipe-materials.mjs [--mode production] --apply  change
import { neon } from '@neondatabase/serverless'
import { loadEnv, modeArg } from './env.mjs'
import { duplicateGroups } from '../src/lib/materialKeys.js'

const mode = modeArg()
loadEnv(mode)
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) throw new Error('Set server-only DATABASE_URL first.')
const apply = process.argv.includes('--apply')
const query = neon(url)

const materials = await query`
  select m.id, m.code, m.name, m.kind, m.is_active,
    coalesce((select sum(quantity_remaining) from inventory_lots l where l.material_id = m.id and l.status = 'open'), 0)::float on_hand,
    ((select count(*) from inventory_lots l where l.material_id = m.id)
      + (select count(*) from production_inputs i where i.material_id = m.id))::int history,
    (select count(*) from production_recipe_items r where r.material_id = m.id)::int recipe_uses
  from materials m where m.is_active order by m.id`
const stats = Object.fromEntries(
  materials.map(m => [m.id, { onHand: m.on_hand, history: m.history }])
)
const label = m =>
  `${m.name} [${m.code}] (stock ${m.on_hand}, history ${m.history}, in ${m.recipe_uses} recipe lines)`

const statements = []
const report = []
for (const { key, items } of duplicateGroups(materials, stats)) {
  const [keep, ...others] = items
  report.push(`\n${key}: keep ${label(keep)}`)
  for (const other of others) {
    if (other.on_hand > 0 || other.history > 0) {
      report.push(
        `  ! leave ${label(other)} — it has stock or history; merge by hand if it is the same item`
      )
      continue
    }
    report.push(`  - move recipes from ${label(other)} and deactivate it`)
    // A recipe that already lists the kept item just drops the duplicate line.
    statements.push(
      query`delete from production_recipe_items d where d.material_id = ${other.id}
        and exists (select 1 from production_recipe_items k where k.recipe_id = d.recipe_id and k.material_id = ${keep.id})`,
      query`update production_recipe_items set material_id = ${keep.id} where material_id = ${other.id}`,
      query`update materials set is_active = false where id = ${other.id}`
    )
  }
}

console.log(`Database: ${mode}`)
if (!report.length) {
  console.log('No duplicate supply items found. Nothing to repair.')
} else {
  console.log(report.join('\n'))
  if (!statements.length) console.log('\nNothing can be changed automatically.')
  else if (!apply)
    console.log('\nPreview only. Re-run with --apply to make these changes.')
  else {
    await query.transaction(statements)
    console.log('\nRepaired. Reload the Home screen.')
  }
}
