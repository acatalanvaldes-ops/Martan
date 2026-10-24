-- ============================================================
-- Martan · Margen por mayor (precio de la caja) = 25% para todos los productos
-- (indicado por Martan, 2026-10-24). Las excepciones se cambian a mano en /admin.
--   precio caja = costo neto × 1,25 (margen) × 1,19 (IVA), redondeado a $10
-- El margen al detalle (precio por kilo/bolsa, 30%) no cambia.
-- ============================================================

update productos
   set margen = 25,
       precio = (round(costo::numeric * 1.25 * 1.19 / 10) * 10)::integer
 where costo > 0;

-- Sin costo cargado no se puede calcular: queda el 25% anotado y el precio actual se mantiene.
update productos
   set margen = 25
 where costo is null or costo = 0;

-- Productos nuevos: parten con 25% por mayor y 30% al detalle.
alter table productos alter column margen set default 25;
alter table productos alter column margen_kilo set default 30;
