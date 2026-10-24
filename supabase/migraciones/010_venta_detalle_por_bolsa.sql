-- ============================================================
-- Martan · Venta al detalle por BOLSA cerrada (indicado por Martan, 2026-10-24)
-- Si "kilos_por_bolsa" tiene valor, el detalle se vende por bolsa:
--   precio de la bolsa = precio_kilo × kilos_por_bolsa (redondeado a $10)
--   cada bolsa descuenta kilos_por_bolsa kilos del stock.
-- Si está vacío, el detalle se vende por kilo, como hasta ahora.
-- ============================================================

alter table productos add column if not exists kilos_por_bolsa numeric(10,3)
  check (kilos_por_bolsa is null or kilos_por_bolsa > 0);

update productos set kilos_por_bolsa = 2.5 where slug = 'papas-prefritas-2-5kg';
update productos set kilos_por_bolsa = 3   where slug in ('nuggets-3kg', 'chicken-finger-3kg');
update productos set kilos_por_bolsa = 2   where slug = 'alitas-3kg';
update productos set kilos_por_bolsa = 0.2 where slug in ('choclo-200g', 'arveja-200g', 'primavera-200g');

notify pgrst, 'reload schema';
