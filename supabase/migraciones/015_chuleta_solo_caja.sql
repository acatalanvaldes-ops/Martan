-- ============================================================
-- Martan · Chuleta vetada: solo por caja (indicado por Martan, 2026-10-24)
-- ============================================================

update productos
   set precio_kilo = null,
       margen_kilo = null,
       kilos_por_bolsa = null
 where slug = 'chuleta-vetada'
    or nombre ilike 'chuleta vetada%';
