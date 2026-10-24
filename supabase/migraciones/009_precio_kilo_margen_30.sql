-- ============================================================
-- Martan · Precio por kilo (al detalle) con 30% de margen sobre el costo
-- (indicado por Martan, 2026-10-24)
--   costo por kg  = costo de la caja ÷ kilos por caja
--   precio por kg = costo por kg × 1,30 (margen) × 1,19 (IVA), redondeado a $10
-- Solo productos con costo cargado y más de 1 kg por caja.
-- ============================================================

update productos
   set margen_kilo = 30,
       precio_kilo = (round(costo::numeric / kilos_por_caja * 1.30 * 1.19 / 10) * 10)::integer
 where costo > 0
   and kilos_por_caja > 1;

-- Sin costo cargado no se puede calcular el precio: queda el margen anotado para cuando se cargue.
update productos
   set margen_kilo = 30
 where (costo is null or costo = 0)
   and kilos_por_caja > 1
   and margen_kilo is null;
