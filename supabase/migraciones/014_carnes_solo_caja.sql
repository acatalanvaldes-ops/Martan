-- ============================================================
-- Martan · Carne molida, Filete de pollo y Ave cubo: solo por caja (indicado por Martan, 2026-10-24)
-- Sin precio por kilo la tienda los vende solo por caja. Se mantienen los kilos por caja
-- para que el stock siga en kilos (9 kg = 3 cajas).
-- ============================================================

update productos
   set precio_kilo = null,
       margen_kilo = null,
       kilos_por_bolsa = null
 where slug in ('carne-molida', 'filete-de-pollo', 'ave-cubo')
    or nombre ilike 'carne molida%'
    or nombre ilike 'filete de pollo%'
    or nombre ilike 'ave cubo%';
