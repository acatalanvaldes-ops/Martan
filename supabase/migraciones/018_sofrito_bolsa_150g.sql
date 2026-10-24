-- ============================================================
-- Martan · Sofrito: caja de 40 bolsas × 150 g = 6 kg (indicado por Martan, 2026-10-24)
-- Tenía 40 en "kg por bolsa" (era la cantidad de bolsas): el detalle se cobraba como bolsa de 40 kg.
-- Se corrige a 0,15 kg por bolsa; el precio por kilo (30% de margen) no cambia.
-- ============================================================

update productos
   set kilos_por_caja  = 6,
       kilos_por_bolsa = 0.15,
       formato = 'Bolsa 150 g'
 where (slug = 'sofrito-150g' or nombre ilike 'sofrito%')
   and kilos_por_bolsa is distinct from 0.15;
