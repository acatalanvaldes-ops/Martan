-- ============================================================
-- Martan · Nueva categoría «Aperitivos»: papas prefritas y empanadas
-- (indicado por Martan, 2026-10-24)
-- ============================================================

update productos
   set categoria = 'Aperitivos'
 where slug = 'papas-prefritas-2-5kg'
    or slug = 'empanadas-caja-24'
    or nombre ilike 'papas prefritas%'
    or nombre ilike 'empanadas%';
