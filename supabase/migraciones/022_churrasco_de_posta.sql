-- ============================================================
-- Martan · Nuevo producto: Churrasco de posta (indicado por Martan, 2026-10-28)
--   Caja de 3 kg, solo por caja (como el resto de las carnes). Stock en kilos (3 kg = 1 caja).
--   Queda OCULTO con el precio marcador 3 hasta que se cargue el costo y el stock en /admin:
--   con 25% de margen y la comisión de tarjeta el precio se calcula solo.
-- ============================================================

insert into productos (
  slug, nombre, categoria, formato, descripcion, precio, stock, activo, orden,
  imagen_url, kilos_por_caja, margen, temporada, conservacion, preparacion, receta
) values (
  'churrasco-de-posta',
  'Churrasco de posta',
  'Carnes',
  'Caja 3 KG',
  'Láminas finas de posta de vacuno, listas para la plancha. Ideales para churrascos, barros luco y chacareros.',
  3, 0, false, 505,
  'https://www.martan.cl/assets/productos/churrasco-de-posta.jpg',
  3, 25,
  'Todo el año',
  'Mantener congelado a −18 °C. Una vez descongelado, no volver a congelar.',
  $$Descongelar en el refrigerador de 6 a 8 horas antes de cocinar; nunca a temperatura ambiente. Al ser láminas delgadas, se cocinan en 1 a 2 minutos por lado en plancha o sartén bien caliente, con poco aceite. Salar al final para que no suelten jugo.$$,
  $$Chacarero

Ingredientes (4 sándwiches):
- 4 churrascos de posta
- 4 marraquetas o panes frica
- 250 g de porotos verdes cocidos
- 2 tomates en rodajas
- 1 ají verde picado (opcional)
- Mayonesa, sal y aceite

Preparación:
1. Cuece los porotos verdes en agua con sal por 5 minutos y córtalos en trozos.
2. Calienta una plancha o sartén con un poco de aceite.
3. Cocina los churrascos 1 a 2 minutos por lado y sálalos al final.
4. Tuesta el pan, úntalo con mayonesa y arma con el churrasco, el tomate, los porotos verdes y el ají.
5. Sirve de inmediato, bien caliente.$$
)
on conflict (slug) do nothing;
