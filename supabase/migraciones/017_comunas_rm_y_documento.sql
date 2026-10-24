-- ============================================================
-- Martan · Despacho a toda la Región Metropolitana + boleta o factura
-- (indicado por Martan, 2026-10-24)
--   Gran Santiago (32 comunas de la Prov. de Santiago + Puente Alto y San Bernardo): $3.990
--   Comunas periféricas (resto de la RM, 18 comunas): $4.990
-- ============================================================

insert into zonas_despacho (comuna, costo, activo) values
  -- Gran Santiago · $3.990
  ('Cerrillos', 3990, true), ('Cerro Navia', 3990, true), ('Conchalí', 3990, true), ('El Bosque', 3990, true),
  ('Estación Central', 3990, true), ('Huechuraba', 3990, true), ('Independencia', 3990, true), ('La Cisterna', 3990, true),
  ('La Florida', 3990, true), ('La Granja', 3990, true), ('La Pintana', 3990, true), ('La Reina', 3990, true),
  ('Las Condes', 3990, true), ('Lo Barnechea', 3990, true), ('Lo Espejo', 3990, true), ('Lo Prado', 3990, true),
  ('Macul', 3990, true), ('Maipú', 3990, true), ('Ñuñoa', 3990, true), ('Pedro Aguirre Cerda', 3990, true),
  ('Peñalolén', 3990, true), ('Providencia', 3990, true), ('Pudahuel', 3990, true), ('Quilicura', 3990, true),
  ('Quinta Normal', 3990, true), ('Recoleta', 3990, true), ('Renca', 3990, true), ('San Joaquín', 3990, true),
  ('San Miguel', 3990, true), ('San Ramón', 3990, true), ('Santiago', 3990, true), ('Vitacura', 3990, true),
  ('Puente Alto', 3990, true), ('San Bernardo', 3990, true),
  -- Comunas periféricas · $4.990
  ('Colina', 4990, true), ('Lampa', 4990, true), ('Tiltil', 4990, true),
  ('Pirque', 4990, true), ('San José de Maipo', 4990, true),
  ('Buin', 4990, true), ('Calera de Tango', 4990, true), ('Paine', 4990, true),
  ('Talagante', 4990, true), ('El Monte', 4990, true), ('Isla de Maipo', 4990, true), ('Padre Hurtado', 4990, true), ('Peñaflor', 4990, true),
  ('Melipilla', 4990, true), ('Alhué', 4990, true), ('Curacaví', 4990, true), ('María Pinto', 4990, true), ('San Pedro', 4990, true)
on conflict (comuna) do update set costo = excluded.costo, activo = true;

-- ---------- Documento tributario del pedido ----------
alter table pedidos add column if not exists documento text not null default 'boleta' check (documento in ('boleta', 'factura'));
alter table pedidos add column if not exists factura_razon_social text;
alter table pedidos add column if not exists factura_rut          text;
alter table pedidos add column if not exists factura_giro         text;
alter table pedidos add column if not exists factura_direccion    text;
alter table pedidos add column if not exists factura_comuna       text;
alter table pedidos add column if not exists factura_email        text;

notify pgrst, 'reload schema';
