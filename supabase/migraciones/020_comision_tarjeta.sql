-- ============================================================
-- Martan · Comisión del cobro con tarjeta (Mercado Pago) en el precio (indicado por Martan, 2026-10-24)
--   La comisión (3,19% por defecto, editable por producto) se calcula sobre el precio neto, antes del IVA:
--   precio final = costo × (1 + margen) × (1 + comisión) × 1,19, redondeado a $10
--   Igual para el precio por kilo/bolsa, con el margen al detalle.
-- ============================================================

alter table productos add column if not exists comision numeric(5,2) not null default 3.19
  check (comision >= 0 and comision < 50);

update productos
   set precio = (round(costo::numeric * (1 + margen / 100) * (1 + comision / 100) * 1.19 / 10) * 10)::integer
 where costo > 0 and margen is not null;

update productos
   set precio_kilo = (round(costo::numeric / kilos_por_caja * (1 + margen_kilo / 100) * (1 + comision / 100) * 1.19 / 10) * 10)::integer
 where costo > 0 and kilos_por_caja > 1 and margen_kilo is not null and precio_kilo is not null;

notify pgrst, 'reload schema';
