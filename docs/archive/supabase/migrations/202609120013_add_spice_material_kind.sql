-- Retained record of an unapplied Supabase compatibility migration.
-- Supabase was retired on 2026-09-12; do not apply this file.
alter type public.material_kind add value if not exists 'spice';
alter type public.supplier_kind add value if not exists 'spice';
