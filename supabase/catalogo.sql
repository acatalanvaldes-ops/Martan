-- ============================================================
-- Martan · Catálogo real (reemplaza los productos de ejemplo)
-- Ejecutar en Supabase → SQL Editor → New query → Run
--
-- Los productos quedan OCULTOS (activo = false) y con stock 0 hasta que
-- se les asigne precio y stock desde /admin. El precio 3 es solo un
-- marcador: un producto oculto no se puede comprar.
-- Se puede ejecutar más de una vez sin duplicar nada.
-- ============================================================

-- 1) Productos de ejemplo: se borran los que no están en ningún pedido
--    y se ocultan los que sí (para no romper el historial).
with ejemplo(slug) as (values
  ('empanadas-pino-12'), ('empanadas-queso-24'), ('pizza-margarita'), ('pizza-pepperoni'),
  ('camarones-ecuatorianos'), ('salmon-porciones'), ('hamburguesas-vacuno'), ('nuggets-pollo'),
  ('mix-verduras'), ('papas-prefritas'), ('helado-manjar'), ('frutillas-congeladas')
)
delete from productos p
 using ejemplo e
 where p.slug = e.slug
   and not exists (select 1 from pedido_items i where i.producto_id = p.id);

update productos set activo = false
 where slug in ('empanadas-pino-12', 'empanadas-queso-24', 'pizza-margarita', 'pizza-pepperoni',
                'camarones-ecuatorianos', 'salmon-porciones', 'hamburguesas-vacuno', 'nuggets-pollo',
                'mix-verduras', 'papas-prefritas', 'helado-manjar', 'frutillas-congeladas');

-- 2) Catálogo real
insert into productos (slug, nombre, categoria, formato, precio, stock, activo, orden) values
  -- Verduras (kg)
  ('papas-prefritas-2-5kg',   'Papas prefritas',          'Verduras',          'Bolsa 2,5 kg', 3, 0, false, 101),
  ('choclo-1kg',              'Choclo',                   'Verduras',          'Bolsa 1 kg',   3, 0, false, 102),
  ('primavera-1kg',           'Primavera',                'Verduras',          'Bolsa 1 kg',   3, 0, false, 103),
  ('arveja-1kg',              'Arveja',                   'Verduras',          'Bolsa 1 kg',   3, 0, false, 104),
  ('poroto-verde-1kg',        'Poroto verde',             'Verduras',          'Bolsa 1 kg',   3, 0, false, 105),
  ('porotos-granados-1kg',    'Porotos granados',         'Verduras',          'Bolsa 1 kg',   3, 0, false, 106),
  ('pasta-de-choclo-1kg',     'Pasta de choclo',          'Verduras',          'Bolsa 1 kg',   3, 0, false, 107),
  -- Vegetales 200 g
  ('choclo-200g',             'Choclo',                   'Vegetales 200 g',   'Bolsa 200 g',  3, 0, false, 201),
  ('arveja-200g',             'Arveja',                   'Vegetales 200 g',   'Bolsa 200 g',  3, 0, false, 202),
  ('primavera-200g',          'Primavera',                'Vegetales 200 g',   'Bolsa 200 g',  3, 0, false, 203),
  ('choclo-trocito',          'Choclo trocito',           'Vegetales 200 g',   '',             3, 0, false, 204),
  ('sofrito-150g',            'Sofrito',                  'Vegetales 200 g',   'Bolsa 150 g',  3, 0, false, 205),
  -- Empanadas
  ('empanadas-caja-24',       'Empanadas',                'Empanadas',         'Caja 24 unidades', 3, 0, false, 301),
  -- Pollo
  ('nuggets-3kg',             'Nuggets',                  'Pollo',             'Bolsa 3 kg',   3, 0, false, 401),
  ('alitas-3kg',              'Alitas',                   'Pollo',             'Bolsa 3 kg',   3, 0, false, 402),
  ('chicken-finger-3kg',      'Chicken finger',           'Pollo',             'Bolsa 3 kg',   3, 0, false, 403),
  -- Carnes
  ('carne-molida',            'Carne molida',             'Carnes',            '',             3, 0, false, 501),
  ('filete-de-pollo',         'Filete de pollo',          'Carnes',            '',             3, 0, false, 502),
  ('ave-cubo',                'Ave cubo',                 'Carnes',            '',             3, 0, false, 503),
  ('chuleta-vetada',          'Chuleta vetada',           'Carnes',            '',             3, 0, false, 504),
  -- Frutas congeladas
  ('frambuesa',               'Frambuesa',                'Frutas',            '',             3, 0, false, 601),
  ('arandano',                'Arándano',                 'Frutas',            '',             3, 0, false, 602),
  ('frutilla',                'Frutilla',                 'Frutas',            '',             3, 0, false, 603),
  ('mora',                    'Mora',                     'Frutas',            '',             3, 0, false, 604),
  ('frambuesa-crumble',       'Frambuesa crumble',        'Frutas',            '',             3, 0, false, 605),
  ('mango',                   'Mango',                    'Frutas',            '',             3, 0, false, 606),
  ('pina',                    'Piña',                     'Frutas',            '',             3, 0, false, 607),
  ('melon-tuna',              'Melón tuna',               'Frutas',            '',             3, 0, false, 608),
  -- Pulpas de fruta
  ('pulpa-frambuesa',         'Pulpa de frambuesa',       'Pulpas de fruta',   '',             3, 0, false, 701),
  ('pulpa-frutilla',          'Pulpa de frutilla',        'Pulpas de fruta',   '',             3, 0, false, 702),
  ('pulpa-mango',             'Pulpa de mango',           'Pulpas de fruta',   '',             3, 0, false, 703),
  ('pulpa-pina',              'Pulpa de piña',            'Pulpas de fruta',   '',             3, 0, false, 704),
  ('pulpa-chirimoya',         'Pulpa de chirimoya',       'Pulpas de fruta',   '',             3, 0, false, 705),
  ('pulpa-lucuma',            'Pulpa de lúcuma',          'Pulpas de fruta',   '',             3, 0, false, 706),
  ('pulpa-melon-tuna',        'Pulpa de melón tuna',      'Pulpas de fruta',   '',             3, 0, false, 707),
  ('pulpa-mix-tropical',      'Pulpa mix tropical',       'Pulpas de fruta',   '',             3, 0, false, 708),
  -- Lácteos
  ('queso-gauda-la-hacienda-500g', 'Queso gauda La Hacienda', 'Lácteos',       '500 g',        3, 0, false, 801)
on conflict (slug) do update
  set nombre = excluded.nombre, categoria = excluded.categoria,
      formato = excluded.formato, orden = excluded.orden;
-- (si se vuelve a ejecutar, NO toca precio, stock ni visibilidad ya cargados)

select categoria, count(*) as productos from productos where orden > 100 group by categoria order by min(orden);
