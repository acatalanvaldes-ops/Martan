-- ============================================================
-- Martan · Costo y margen de cada producto (solo visibles en /admin)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Se puede ejecutar más de una vez.
-- ============================================================

-- Costo neto unitario (sin IVA), en CLP
alter table productos add column if not exists costo integer check (costo is null or costo >= 0);

-- Margen deseado sobre el costo, en % (ej. 30 = precio neto es costo × 1,30)
alter table productos add column if not exists margen numeric(6,2) check (margen is null or margen > -100);

-- Avisa a la API de Supabase que hay columnas nuevas (si no, puede seguir diciendo que no existen).
notify pgrst, 'reload schema';

-- El precio de venta (columna "precio") sigue siendo el precio final CON IVA que paga el cliente.
-- La tienda pública nunca lee "costo" ni "margen": /api/catalogo solo selecciona columnas públicas.

select column_name, data_type from information_schema.columns
 where table_name = 'productos' and column_name in ('precio', 'costo', 'margen');
