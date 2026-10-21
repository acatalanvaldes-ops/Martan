-- ============================================================
-- Martan · Mensajes del formulario de contacto (/contacto)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Se puede ejecutar más de una vez.
-- ============================================================

create table if not exists contactos (
  id            bigint generated always as identity primary key,
  creado_en     timestamptz not null default now(),
  tipo          text not null check (tipo in ('sugerencia', 'reclamo', 'cotizacion', 'factura')),
  nombre        text not null,
  rut           text not null,
  email         text not null,
  telefono      text,
  pedido_numero bigint,
  mensaje       text not null,
  estado        text not null default 'nuevo' check (estado in ('nuevo', 'en_proceso', 'cerrado'))
);
create index if not exists contactos_creado_idx on contactos (creado_en desc);

-- Igual que el resto: sin políticas, solo las funciones de Vercel (clave secreta) pueden leer y escribir.
alter table contactos enable row level security;

notify pgrst, 'reload schema';

select 'contactos' as tabla, count(*) as mensajes from contactos;
