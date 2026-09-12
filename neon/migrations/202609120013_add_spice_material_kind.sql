-- Spices are traceable production inputs, received and consumed as material lots.
alter type public.material_kind add value if not exists 'spice';
alter type public.supplier_kind add value if not exists 'spice';
