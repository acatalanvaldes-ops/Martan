-- ============================================================
-- Martan · Venta por caja (precio mayorista) o por unidad (precio detalle)
-- Se aplica sola en el deploy (scripts/migrar.mjs).
--
-- Desde aquí el STOCK se cuenta en UNIDADES: una caja descuenta
-- "unidades_por_caja" unidades. El precio de siempre ("precio") es el
-- de la CAJA; "precio_unidad" es el precio al detalle.
-- ============================================================

alter table productos add column if not exists unidades_por_caja integer not null default 1 check (unidades_por_caja >= 1);
alter table productos add column if not exists formato_unidad    text;     -- ej. "Bolsa 1 kg"
alter table productos add column if not exists precio_unidad     integer check (precio_unidad is null or precio_unidad >= 0);
alter table productos add column if not exists margen_unidad     numeric(6,2) check (margen_unidad is null or margen_unidad > -100);

alter table pedido_items add column if not exists modo     text not null default 'caja' check (modo in ('caja', 'unidad'));
alter table pedido_items add column if not exists unidades integer;  -- unidades de stock que descuenta la línea

-- Unidades por caja detectadas desde lo ya cargado: "Choclo 16*1" → 16, "Caja 48 unidades" → 48.
-- El stock que estaba en cajas se convierte a unidades (5 cajas × 16 = 80 unidades).
with detectado as (
  select id,
         coalesce((regexp_match(nombre,  '(\d+)\s*[*x×]\s*\d'))[1]::int,
                  (regexp_match(formato, '(\d+)\s*[*x×]\s*\d'))[1]::int,
                  (regexp_match(formato, '(\d+)\s*unidades', 'i'))[1]::int,
                  (regexp_match(nombre,  '(\d+)\s*unidades', 'i'))[1]::int,
                  1) as n
    from productos
)
update productos p
   set unidades_por_caja = d.n,
       stock = p.stock * d.n
  from detectado d
 where d.id = p.id and p.unidades_por_caja = 1 and d.n > 1;

-- Confirmación de pago: descuenta UNIDADES (sumadas por producto, por si el pedido
-- trae el mismo producto por caja y por unidad). Las líneas antiguas usan "cantidad".
create or replace function marcar_pedido_pagado(p_pedido uuid, p_pago text, p_monto integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v pedidos%rowtype;
begin
  select * into v from pedidos where id = p_pedido for update;
  if not found then
    return 'no_existe';
  end if;
  if v.estado not in ('pendiente_pago', 'rechazado') then
    return 'ya_procesado';
  end if;
  if p_monto < v.total then
    update pedidos set mp_pago_id = p_pago, mp_estado = 'monto_invalido', actualizado_en = now()
     where id = p_pedido;
    return 'monto_invalido';
  end if;

  update productos p
     set stock = greatest(p.stock - t.unidades, 0)
    from (select producto_id, sum(coalesce(unidades, cantidad)) as unidades
            from pedido_items
           where pedido_id = p_pedido and producto_id is not null
           group by producto_id) t
   where p.id = t.producto_id;

  update pedidos
     set estado = 'pagado', mp_pago_id = p_pago, mp_estado = 'approved',
         pagado_en = now(), actualizado_en = now()
   where id = p_pedido;
  return 'ok';
end;
$$;

revoke execute on function marcar_pedido_pagado(uuid, text, integer) from public, anon, authenticated;

notify pgrst, 'reload schema';
