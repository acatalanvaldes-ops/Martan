-- ============================================================
-- Martan · Kilos por caja reales (informados por Martan, 2026-10-24)
--   Frutas y pulpas ............................. caja de 10 kg
--   Primavera 1 kg, Arveja 1 kg, Porotos granados  caja de 15 kg
-- El stock de estos productos estaba en cajas de "1 kg": se convierte a kilos
-- reales (cajas × kilos por caja). Solo toca productos que aún tienen 1 kg por caja.
-- ============================================================

update productos
   set stock = round(stock * 10 / kilos_por_caja, 3),
       kilos_por_caja = 10
 where categoria in ('Frutas', 'Pulpas de fruta')
   and kilos_por_caja = 1;

update productos
   set stock = round(stock * 15 / kilos_por_caja, 3),
       kilos_por_caja = 15
 where slug in ('primavera-1kg', 'arveja-1kg', 'porotos-granados-1kg')
   and kilos_por_caja = 1;
