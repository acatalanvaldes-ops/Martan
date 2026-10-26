-- ============================================================
-- Martan · Categorías con subcategorías (indicado por Martan, 2026-10-26)
--   Vegetales → Kilo (bolsas de 1 kg, antes "Verduras") e Individual (antes "Vegetales 200 g")
--   Frutas    → Frutas y Pulpas de fruta (antes categoría propia)
--   Aperitivos, Pollo y Carnes siguen igual, sin subcategoría.
-- ============================================================

alter table productos add column if not exists subcategoria text;

update productos set categoria = 'Vegetales', subcategoria = 'Kilo'            where categoria = 'Verduras';
update productos set categoria = 'Vegetales', subcategoria = 'Individual'      where categoria = 'Vegetales 200 g';
update productos set categoria = 'Frutas',    subcategoria = 'Frutas'          where categoria = 'Frutas';
update productos set categoria = 'Frutas',    subcategoria = 'Pulpas de fruta' where categoria = 'Pulpas de fruta';

notify pgrst, 'reload schema';
