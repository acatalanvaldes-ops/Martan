-- ============================================================
-- Martan · Choclo trocito: caja de 20 bolsas × 180 g = 3,6 kg (indicado por Martan, 2026-10-24)
-- Detalle por bolsa de 180 g; precio por kilo con 30% de margen sobre el costo (como el resto).
-- El stock estaba en cajas (sin kilos): pasa a kilos (cajas × 3,6).
-- ============================================================

update productos
   set kilos_por_caja  = 3.6,
       kilos_por_bolsa = 0.18,
       formato = coalesce(nullif(formato, ''), 'Bolsa 180 g'),
       stock = round(stock * 3.6, 3)
 where (slug = 'choclo-trocito' or nombre ilike 'choclo trocito%')
   and kilos_por_caja is null;

update productos
   set margen_kilo = 30,
       precio_kilo = case when costo > 0
                          then (round(costo::numeric / 3.6 * 1.30 * 1.19 / 10) * 10)::integer
                          else precio_kilo end
 where (slug = 'choclo-trocito' or nombre ilike 'choclo trocito%');
