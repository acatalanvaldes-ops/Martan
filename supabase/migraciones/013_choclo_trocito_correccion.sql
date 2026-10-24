-- ============================================================
-- Martan · Corrección Choclo trocito (2026-10-24)
-- Tenía "20" en kilos por caja (eran las 20 bolsas), por eso 012 no lo actualizó.
-- Caja real: 20 bolsas × 180 g = 3,6 kg. El stock "5" corresponde a 5 cajas → 18 kg.
-- ============================================================

update productos
   set kilos_por_caja  = 3.6,
       kilos_por_bolsa = 0.18,
       formato = coalesce(nullif(formato, ''), 'Bolsa 180 g'),
       stock = case when kilos_por_caja = 20 and stock = 5 then 18 else stock end
 where (slug = 'choclo-trocito' or nombre ilike 'choclo trocito%')
   and kilos_por_caja is distinct from 3.6;
