-- ============================================================
-- Martan · Tienda de congelados
-- Ejecutar completo en Supabase → SQL Editor → New query → Run
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Catálogo ----------
create table if not exists productos (
  id              bigint generated always as identity primary key,
  slug            text unique not null,
  nombre          text not null,
  descripcion     text not null default '',
  categoria       text not null,
  formato         text not null default '',          -- ej. "Bolsa 1 kg", "Caja 12 unidades"
  precio          integer not null check (precio >= 0),   -- en CLP
  precio_anterior integer check (precio_anterior is null or precio_anterior >= 0),
  stock           integer not null default 0 check (stock >= 0),
  imagen_url      text,
  destacado       boolean not null default false,
  activo          boolean not null default true,
  orden           integer not null default 0,
  creado_en       timestamptz not null default now()
);

-- ---------- Entrega ----------
create table if not exists zonas_despacho (
  id      bigint generated always as identity primary key,
  comuna  text unique not null,
  costo   integer not null check (costo >= 0),
  activo  boolean not null default true
);

create table if not exists puntos_retiro (
  id        bigint generated always as identity primary key,
  nombre    text not null,
  direccion text not null,
  horario   text not null default '',
  activo    boolean not null default true
);

-- Una sola fila (id = 1) con la configuración general de la tienda
create table if not exists configuracion (
  id                    integer primary key default 1 check (id = 1),
  monto_minimo          integer not null default 0,
  despacho_gratis_desde integer,              -- null = nunca gratis
  whatsapp              text,                 -- ej. "56912345678"
  email_contacto        text
);

-- ---------- Pedidos ----------
create table if not exists pedidos (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity unique,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  pagado_en        timestamptz,
  estado           text not null default 'pendiente_pago' check (estado in (
                     'pendiente_pago', 'pagado', 'rechazado', 'en_preparacion',
                     'en_camino', 'listo_retiro', 'entregado', 'cancelado')),
  cliente_nombre   text not null,
  cliente_email    text not null,
  cliente_telefono text not null,
  cliente_rut      text,
  entrega          text not null check (entrega in ('despacho', 'retiro')),
  comuna           text,
  direccion        text,
  referencia       text,
  punto_retiro_id  bigint references puntos_retiro(id),
  notas            text,
  subtotal         integer not null,
  costo_despacho   integer not null default 0,
  total            integer not null,
  mp_preferencia_id text,
  mp_pago_id       text,
  mp_estado        text
);
create index if not exists pedidos_creado_idx on pedidos (creado_en desc);
create index if not exists pedidos_estado_idx on pedidos (estado);

create table if not exists pedido_items (
  id              bigint generated always as identity primary key,
  pedido_id       uuid not null references pedidos(id) on delete cascade,
  producto_id     bigint references productos(id),
  nombre          text not null,
  formato         text not null default '',
  precio_unitario integer not null,
  cantidad        integer not null check (cantidad > 0),
  subtotal        integer not null
);
create index if not exists pedido_items_pedido_idx on pedido_items (pedido_id);

-- ---------- Seguridad ----------
-- RLS activado SIN políticas: nadie puede leer ni escribir con la clave pública.
-- Todo pasa por las funciones de Vercel (api/), que usan la clave secreta.
alter table productos      enable row level security;
alter table zonas_despacho enable row level security;
alter table puntos_retiro  enable row level security;
alter table configuracion  enable row level security;
alter table pedidos        enable row level security;
alter table pedido_items   enable row level security;

-- ---------- Confirmación de pago ----------
-- Marca el pedido como pagado y descuenta stock UNA sola vez (bloquea la fila).
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
     set stock = greatest(p.stock - i.cantidad, 0)
    from pedido_items i
   where i.pedido_id = p_pedido and i.producto_id = p.id;

  update pedidos
     set estado = 'pagado', mp_pago_id = p_pago, mp_estado = 'approved',
         pagado_en = now(), actualizado_en = now()
   where id = p_pedido;
  return 'ok';
end;
$$;

revoke execute on function marcar_pedido_pagado(uuid, text, integer) from public, anon, authenticated;

-- ============================================================
-- Datos de ejemplo (reemplázalos desde el panel /admin o el Table Editor)
-- ============================================================
insert into configuracion (id, monto_minimo, despacho_gratis_desde, whatsapp, email_contacto)
values (1, 15000, 50000, '56900000000', 'contacto@martan.cl')
on conflict (id) do nothing;

insert into zonas_despacho (comuna, costo) values
  ('Santiago', 3990), ('Providencia', 3490), ('Ñuñoa', 3490), ('Las Condes', 3990),
  ('Vitacura', 4490), ('La Reina', 3990), ('Macul', 3990), ('San Miguel', 3990),
  ('Maipú', 4990), ('La Florida', 4490), ('Puente Alto', 4990), ('Peñalolén', 4490)
on conflict (comuna) do nothing;

insert into puntos_retiro (nombre, direccion, horario)
select 'Local Martan', 'Av. Ejemplo 1234, Ñuñoa', 'Lunes a sábado, 10:00 a 19:00'
where not exists (select 1 from puntos_retiro);

insert into productos (slug, nombre, descripcion, categoria, formato, precio, precio_anterior, stock, destacado, orden) values
  ('empanadas-pino-12', 'Empanadas de pino', 'Pino tradicional de carne, cebolla, huevo y aceituna. Listas para hornear.', 'Empanadas', 'Caja 12 unidades', 14990, null, 40, true, 1),
  ('empanadas-queso-24', 'Empanaditas de queso', 'Masa crujiente con queso mantecoso. Ideales para freír o al horno.', 'Empanadas', 'Bolsa 24 unidades', 8990, 9990, 35, false, 2),
  ('pizza-margarita', 'Pizza margarita', 'Masa madre, salsa de tomate natural, mozzarella y albahaca.', 'Pizzas', '1 unidad · 32 cm', 6490, null, 25, true, 3),
  ('pizza-pepperoni', 'Pizza pepperoni', 'Doble pepperoni y mozzarella sobre masa delgada.', 'Pizzas', '1 unidad · 32 cm', 6990, null, 20, false, 4),
  ('camarones-ecuatorianos', 'Camarón ecuatoriano', 'Camarón pelado y desvenado, calibre 41/50. Congelado IQF.', 'Mariscos', 'Bolsa 1 kg', 13990, 15990, 18, true, 5),
  ('salmon-porciones', 'Salmón en porciones', 'Porciones sin piel ni espinas, envasadas al vacío.', 'Mariscos', 'Bolsa 1 kg (5 porciones)', 15990, null, 4, false, 6),
  ('hamburguesas-vacuno', 'Hamburguesas de vacuno', '100% vacuno, 150 g cada una, sin aditivos.', 'Carnes', 'Caja 10 unidades', 10990, null, 30, false, 7),
  ('nuggets-pollo', 'Nuggets de pollo', 'Pechuga de pollo apanada, lista en 12 minutos al horno.', 'Carnes', 'Bolsa 1 kg', 7490, null, 50, false, 8),
  ('mix-verduras', 'Mix de verduras salteadas', 'Brócoli, zanahoria, poroto verde y choclo.', 'Verduras', 'Bolsa 1 kg', 3990, null, 60, false, 9),
  ('papas-prefritas', 'Papas prefritas corte recto', 'Papas seleccionadas, ideales para horno o airfryer.', 'Verduras', 'Bolsa 2,5 kg', 6990, null, 45, false, 10),
  ('helado-manjar', 'Helado de manjar nuez', 'Helado artesanal de manjar con trozos de nuez.', 'Postres', 'Pote 1 litro', 5990, null, 0, false, 11),
  ('frutillas-congeladas', 'Frutillas congeladas', 'Frutillas enteras IQF, perfectas para jugos y postres.', 'Postres', 'Bolsa 1 kg', 4990, null, 28, false, 12)
on conflict (slug) do nothing;
