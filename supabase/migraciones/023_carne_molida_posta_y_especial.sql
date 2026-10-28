-- ============================================================
-- Martan · Nuevos productos: Carne molida posta y Carne molida especial (indicado por Martan, 2026-10-28)
--   Caja de 3 kg, solo por caja (como el resto de las carnes). Stock en kilos (3 kg = 1 caja).
--   La "Carne molida" que ya existe se mantiene como un producto aparte.
--   Quedan OCULTOS con el precio marcador 3 hasta que se cargue el costo y el stock en /admin.
-- ============================================================

insert into productos (
  slug, nombre, categoria, formato, descripcion, precio, stock, activo, orden,
  imagen_url, kilos_por_caja, margen, temporada, conservacion, preparacion, receta
) values
(
  'carne-molida-posta',
  'Carne molida posta',
  'Carnes',
  'Caja 3 KG',
  'Carne molida de posta de vacuno, baja en grasa. Para pino, salsas y preparaciones más livianas.',
  3, 0, false, 506,
  'https://www.martan.cl/assets/productos/carne-molida-posta.jpg',
  3, 25,
  'Todo el año',
  'Mantener congelado a −18 °C. Una vez descongelado, no volver a congelar.',
  $$Descongelar en el refrigerador de 8 a 12 horas antes de cocinar; nunca a temperatura ambiente. Por ser baja en grasa, cocínala a fuego medio con un poco de aceite y revuelve seguido para que no se seque. Debe quedar bien cocida, sin partes rosadas.$$,
  $$Pastel de choclo

Ingredientes (6 porciones):
- 500 g de Carne molida posta
- 1 kg de Pasta de choclo Martan
- 2 cebollas picadas en cubitos
- 3 huevos duros
- Aceitunas, comino, ají de color y sal
- 1 cucharada de azúcar

Preparación:
1. Sofríe la cebolla hasta que esté transparente. Agrega la carne, el comino, el ají de color y sal, y cocina hasta que esté bien cocida (el pino).
2. Calienta la pasta de choclo en una olla, revolviendo, hasta que espese.
3. En una fuente para horno pon el pino, los huevos en rodajas y las aceitunas.
4. Cubre con la pasta de choclo y espolvorea el azúcar.
5. Hornea a 200 °C por 30 minutos, hasta que esté dorado.$$
),
(
  'carne-molida-especial',
  'Carne molida especial',
  'Carnes',
  'Caja 3 KG',
  'Carne molida de vacuno, jugosa y versátil. Ideal para hamburguesas caseras, albóndigas y lasañas.',
  3, 0, false, 507,
  'https://www.martan.cl/assets/productos/carne-molida-especial.jpg',
  3, 25,
  'Todo el año',
  'Mantener congelado a −18 °C. Una vez descongelado, no volver a congelar.',
  $$Descongelar en el refrigerador de 8 a 12 horas antes de cocinar; nunca a temperatura ambiente. Para hamburguesas, forma las porciones con la carne bien fría y cocínalas en plancha caliente 4 a 5 minutos por lado. Debe quedar bien cocida por dentro.$$,
  $$Hamburguesas caseras con papas fritas

Ingredientes (4 hamburguesas):
- 600 g de Carne molida especial
- 1 huevo
- 1/2 cebolla rallada
- Sal, pimienta y orégano
- 4 panes de hamburguesa
- Papas prefritas Martan

Preparación:
1. Mezcla la carne con el huevo, la cebolla, la sal, la pimienta y el orégano.
2. Forma 4 hamburguesas de 2 cm de alto y haz una pequeña hendidura al centro para que no se inflen.
3. Cocínalas en plancha o sartén bien caliente 4 a 5 minutos por lado.
4. Mientras tanto, fríe u hornea las papas prefritas.
5. Arma las hamburguesas con tomate, lechuga y tus salsas favoritas.$$
)
on conflict (slug) do nothing;
