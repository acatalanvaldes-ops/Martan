-- ============================================================
-- Martan · Venta por CAJA (precio por mayor) o por KILO (precio al detalle)
-- Reemplaza la venta "por unidad" (005), que no alcanzó a usarse.
--
--   precio          → precio de la CAJA (por mayor), el de siempre
--   precio_kilo     → precio por KILO (al detalle)
--   kilos_por_caja  → kilos que trae la caja
--   stock           → en KILOS si el producto tiene kilos_por_caja; si no, en CAJAS
-- ============================================================

alter table productos add column if not exists kilos_por_caja numeric(10,3) check (kilos_por_caja is null or kilos_por_caja > 0);
alter table productos add column if not exists precio_kilo    integer       check (precio_kilo is null or precio_kilo >= 0);
alter table productos add column if not exists margen_kilo    numeric(6,2)  check (margen_kilo is null or margen_kilo > -100);

-- Kilos con decimales (ej. caja de 7,5 kg): stock y unidades vendidas pasan a numéricos.
alter table productos    alter column stock    type numeric(12,3);
alter table pedido_items alter column unidades type numeric(12,3);
alter table pedido_items drop constraint if exists pedido_items_modo_check;
alter table pedido_items add constraint pedido_items_modo_check check (modo in ('caja', 'unidad', 'kilo'));

-- Kilos por caja desde lo ya cargado:
--   "Choclo 16*1" + "Bolsa 1 kg"      → 16 × 1 kg      = 16 kg
--   "Arveja 30*200" + "Bolsa 200 g"   → 30 × 200 g     = 6 kg
--   "Papas 4*2.5" + "Caja 10 KG"      → 4 × 2,5 kg     = 10 kg
--   "Carne molida" + "Caja 3 KG"      → 3 kg
--   Sin peso en el formato (empanadas por unidades, choclo trocito) → sin kilos: solo por caja.
with base as (
  select id, stock, unidades_por_caja,
         regexp_match(nombre,  '(\d+)\s*[*x×]\s*(\d+(?:[.,]\d+)?)')                as nm,
         regexp_match(formato, '(\d+(?:[.,]\d+)?)\s*(kg|kilos?|gr|g)(?![a-z])', 'i') as fm
    from productos
),
calculo as (
  select id, stock, unidades_por_caja,
         case
           when fm is null then null
           when nm is not null then nm[1]::numeric * replace(nm[2], ',', '.')::numeric
                                    / (case when lower(fm[2]) in ('g', 'gr') then 1000 else 1 end)
           else replace(fm[1], ',', '.')::numeric
                / (case when lower(fm[2]) in ('g', 'gr') then 1000 else 1 end)
         end as kg
    from base
)
update productos p
   set kilos_por_caja = c.kg,
       -- stock actual: unidades (si unidades_por_caja > 1) o cajas → ahora kilos, o cajas si no hay kilos
       stock = case when c.kg is not null then round(c.stock * c.kg / greatest(c.unidades_por_caja, 1), 3)
                    else round(c.stock / greatest(c.unidades_por_caja, 1), 3) end
  from calculo c
 where p.id = c.id;

notify pgrst, 'reload schema';
