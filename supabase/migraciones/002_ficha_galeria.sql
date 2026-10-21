-- ============================================================
-- Martan · Ficha de producto: galería de fotos y características
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Se puede ejecutar más de una vez.
-- ============================================================

-- Fotos adicionales (la foto principal sigue en "imagen_url")
alter table productos add column if not exists imagenes text[] not null default '{}';

-- Características que se muestran en la ficha del producto
alter table productos add column if not exists temporada    text;  -- ej. "Todo el año" / "Primavera – verano"
alter table productos add column if not exists conservacion text;  -- ej. "Mantener a −18 °C…"
alter table productos add column if not exists preparacion  text;  -- ej. "Horno 200 °C, 15 minutos"
alter table productos add column if not exists receta       text;  -- receta sugerida (texto libre, admite saltos de línea)

-- Conservación estándar para congelados, solo donde aún está vacía (se puede cambiar en /admin)
update productos
   set conservacion = 'Mantener congelado a −18 °C. Una vez descongelado, no volver a congelar.'
 where conservacion is null;

-- Avisa a la API de Supabase que hay columnas nuevas
notify pgrst, 'reload schema';

select column_name, data_type from information_schema.columns
 where table_name = 'productos' and column_name in ('imagenes', 'temporada', 'conservacion', 'preparacion', 'receta')
 order by column_name;
