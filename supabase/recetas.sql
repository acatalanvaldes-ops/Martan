-- ============================================================
-- Martan · Preparación y receta sugerida de cada producto
-- Ejecutar en Supabase → SQL Editor → New query → Run
--
-- Solo completa los campos que están VACÍOS: si después cambias una
-- receta desde /admin y vuelves a ejecutar este script, no se pisa.
-- Se puede ejecutar más de una vez.
-- ============================================================

-- Por si aún no se ejecutó supabase/fichas.sql
alter table productos add column if not exists preparacion text;
alter table productos add column if not exists receta text;

-- ---------- Queso gauda: ya no se vende ----------
-- Los pedidos antiguos conservan su detalle (nombre y precio quedan en pedido_items).
update pedido_items set producto_id = null
 where producto_id in (select id from productos where slug = 'queso-gauda-la-hacienda-500g');
delete from productos where slug = 'queso-gauda-la-hacienda-500g';

-- ---------- Preparación y recetas ----------
update productos p
   set preparacion = coalesce(p.preparacion, v.preparacion),
       receta      = coalesce(p.receta, v.receta)
  from (values

  -- ===== Verduras (1 kg) =====
  ('papas-prefritas-2-5kg',
   $$Sin descongelar: horno o airfryer a 200 °C por 15 a 20 minutos, o freír a 175 °C por 3 a 4 minutos.$$,
   $$Chorrillana casera

Ingredientes:
- ½ bolsa de papas prefritas
- 300 g de carne en tiras
- 2 cebollas en pluma
- 2 huevos
- Merkén y sal

Preparación:
1. Hornea las papas hasta que estén doradas.
2. Saltea la cebolla con la carne y aliña con merkén y sal.
3. Fríe los huevos.
4. Monta en una fuente: papas, carne con cebolla y los huevos encima.$$),

  ('choclo-1kg',
   $$Directo desde congelado, sin descongelar: 5 a 7 minutos en agua hirviendo con sal, o salteado en sartén.$$,
   $$Crema de choclo

Ingredientes:
- 500 g de choclo
- 1 cebolla
- 1 papa
- 500 ml de caldo
- 200 ml de leche
- 1 cucharada de mantequilla

Preparación:
1. Sofríe la cebolla en la mantequilla.
2. Agrega la papa en cubos, el choclo y el caldo; cocina 15 minutos.
3. Licúa con la leche y ajusta la sal.$$),

  ('primavera-1kg',
   $$Directo desde congelado, sin descongelar: 5 a 7 minutos en agua hirviendo con sal, o salteada en sartén.$$,
   $$Arroz primavera

Ingredientes:
- 2 tazas de arroz
- 2 tazas de primavera
- 1 diente de ajo
- 4 tazas de agua caliente
- Aceite y sal

Preparación:
1. Sofríe el arroz con el ajo en un poco de aceite.
2. Agrega el agua caliente con sal.
3. Cuando hierva, suma la primavera.
4. Tapa y cocina a fuego bajo 15 a 18 minutos.$$),

  ('arveja-1kg',
   $$Directo desde congelado, sin descongelar: 5 a 7 minutos en agua hirviendo con sal, o salteada en sartén.$$,
   $$Pollo arvejado

Ingredientes:
- 500 g de Ave cubo
- 2 tazas de arvejas
- 1 cebolla
- 1 zanahoria
- 1 taza de caldo
- 2 huevos

Preparación:
1. Sofríe la cebolla y la zanahoria picadas.
2. Dora el pollo.
3. Agrega las arvejas y el caldo; cocina 15 minutos.
4. Al final, incorpora los huevos batidos revolviendo.$$),

  ('poroto-verde-1kg',
   $$Directo desde congelado, sin descongelar: 5 a 7 minutos en agua hirviendo con sal, o salteado en sartén.$$,
   $$Porotos verdes salteados con huevo

Ingredientes:
- 500 g de porotos verdes
- 1 cebolla
- 1 diente de ajo
- 2 huevos

Preparación:
1. Cuece los porotos verdes 5 minutos y escúrrelos.
2. Saltéalos con la cebolla y el ajo.
3. Agrega los huevos batidos y revuelve hasta que cuajen.$$),

  ('porotos-granados-1kg',
   $$Directo desde congelado, sin descongelar.$$,
   $$Porotos granados con mazamorra

Ingredientes:
- 500 g de porotos granados
- 500 g de Pasta de choclo
- 300 g de zapallo
- 1 cebolla
- Ajo, color y albahaca

Preparación:
1. Haz un sofrito con la cebolla, el ajo y el color.
2. Agrega los porotos y el zapallo en cubos, cubre con agua y cocina 25 a 30 minutos.
3. Suma la pasta de choclo y revuelve 10 minutos.
4. Termina con albahaca picada.$$),

  ('pasta-de-choclo-1kg',
   $$Se cocina directo desde congelado, revolviendo a fuego medio.$$,
   $$Pastel de choclo

Ingredientes:
- 1 kg de pasta de choclo
- 2 bolsas de Carne molida (250 g c/u)
- 2 cebollas
- Ave cubo cocido
- Huevos duros y aceitunas
- ½ taza de leche
- Albahaca y azúcar

Preparación:
1. Prepara un pino con la carne y la cebolla.
2. Cocina la pasta de choclo con la leche y la albahaca 10 minutos.
3. Arma en una fuente: pino, pollo, huevo y aceituna. Cubre con la pasta y espolvorea azúcar.
4. Hornea a 200 °C por 30 a 40 minutos, hasta dorar.$$),

  -- ===== Vegetales 200 g =====
  ('choclo-200g',
   $$Directo desde congelado, sin descongelar: 5 minutos en agua hirviendo con sal, o salteado en sartén.$$,
   $$Tortilla de choclo

Ingredientes:
- 1 bolsa de choclo (200 g)
- 4 huevos
- ½ cebolla
- Sal y pimienta

Preparación:
1. Saltea la cebolla con el choclo.
2. Agrega los huevos batidos con sal y pimienta.
3. Cuaja la tortilla por ambos lados.$$),

  ('arveja-200g',
   $$Directo desde congelado, sin descongelar: 5 minutos en agua hirviendo con sal.$$,
   $$Ensalada rusa

Ingredientes:
- 1 bolsa de arvejas (200 g)
- 3 papas
- 2 zanahorias
- Mayonesa y sal

Preparación:
1. Cuece las papas y las zanahorias en cubos, y las arvejas 5 minutos.
2. Deja enfriar.
3. Mezcla con la mayonesa y ajusta la sal.$$),

  ('primavera-200g',
   $$Directo desde congelado, sin descongelar: 5 minutos en agua hirviendo con sal, o salteada en sartén.$$,
   $$Tallarines salteados

Ingredientes:
- 250 g de tallarines
- 1 bolsa de primavera (200 g)
- 1 diente de ajo
- Salsa de soya

Preparación:
1. Cuece la pasta.
2. Saltea la primavera con el ajo.
3. Mezcla con la pasta y agrega soya a gusto.$$),

  ('choclo-trocito',
   $$Directo desde congelado: agregar a la olla los últimos 10 minutos de cocción.$$,
   $$Cazuela de ave

Ingredientes:
- 4 presas de pollo
- 4 trocitos de choclo
- 4 papas
- 4 trozos de zapallo
- ¼ taza de arroz
- 1 cebolla y 1 zanahoria

Preparación:
1. Dora el pollo con la cebolla.
2. Cubre con agua y cocina 20 minutos.
3. Agrega las papas, el zapallo, la zanahoria y el arroz.
4. 10 minutos después, suma el choclo y cocina 10 minutos más.$$),

  ('sofrito-150g',
   $$Base lista: dorar directo en la olla o sartén, sin descongelar.$$,
   $$Charquicán

Ingredientes:
- 1 bolsa de sofrito
- 1 bolsa de Carne molida (250 g)
- 4 papas
- 500 g de zapallo
- 1 taza de Choclo y 1 taza de Arveja
- Huevo frito para servir

Preparación:
1. Dora el sofrito con la carne.
2. Agrega las papas y el zapallo en cubos con 1 taza de agua; cocina 20 minutos.
3. Muele grueso y suma el choclo y las arvejas por 5 minutos.
4. Sirve con un huevo frito encima.$$),

  -- ===== Empanadas =====
  ('empanadas-caja-24',
   $$Horno precalentado a 200 °C, sin descongelar, por 20 a 25 minutos hasta dorar. Para más brillo, pincélalas con huevo.$$,
   $$Pebre para acompañar

Ingredientes:
- 2 tomates
- 1 cebolla
- 1 atado de cilantro
- 1 ají verde
- Aceite, jugo de limón y sal

Preparación:
1. Pica todo muy fino.
2. Mezcla con el aceite, el limón y la sal.
3. Deja reposar 15 minutos antes de servir.$$),

  -- ===== Pollo (3 kg) =====
  ('nuggets-3kg',
   $$Sin descongelar: horno o airfryer a 200 °C por 12 a 15 minutos, dándolos vuelta a la mitad.$$,
   $$Wrap de nuggets

Ingredientes:
- Tortillas
- Nuggets
- Lechuga y tomate
- Salsa: yogur natural, limón y ajo

Preparación:
1. Hornea los nuggets.
2. Mezcla la salsa de yogur.
3. Calienta las tortillas, rellena con todo y enrolla.$$),

  ('alitas-3kg',
   $$Horno a 200 °C por 25 a 30 minutos, dándolas vuelta a la mitad, hasta que no quede rosado en el centro.$$,
   $$Alitas BBQ con miel

Ingredientes:
- 1 kg de alitas
- ½ taza de salsa BBQ
- 2 cucharadas de miel
- 1 cucharada de soya

Preparación:
1. Hornea las alitas 20 minutos.
2. Mezcla la salsa BBQ, la miel y la soya.
3. Pincela las alitas y hornea 10 minutos más.$$),

  ('chicken-finger-3kg',
   $$Sin descongelar: horno o airfryer a 200 °C por 15 minutos.$$,
   $$Ensalada César

Ingredientes:
- Lechuga
- Chicken finger
- Crutones y queso parmesano
- Salsa: mayonesa, ajo, limón, mostaza y parmesano

Preparación:
1. Hornea el chicken finger y córtalo en tiras.
2. Mezcla la salsa.
3. Arma la ensalada con todo y aliña al servir.$$),

  -- ===== Carnes =====
  ('carne-molida',
   $$Descongelar en el refrigerador de 8 a 12 horas antes de cocinar. Nunca a temperatura ambiente.$$,
   $$Tallarines a la boloñesa

Ingredientes:
- 1 bolsa de carne molida (250 g)
- 1 bolsa de Sofrito
- 400 g de tomate triturado
- Orégano
- 250 g de tallarines

Preparación:
1. Dora el sofrito con la carne.
2. Agrega el tomate y el orégano; cocina 20 minutos.
3. Sirve sobre la pasta recién cocida.$$),

  ('filete-de-pollo',
   $$Descongelar en el refrigerador de 8 a 12 horas antes de cocinar. Nunca a temperatura ambiente.$$,
   $$Pollo a la plancha con limón y merkén

Ingredientes:
- Filetes de pollo
- Jugo de 1 limón
- 1 diente de ajo
- Merkén y sal

Preparación:
1. Marina los filetes con el limón, el ajo y el merkén por 15 minutos.
2. Cocina a la plancha 5 a 6 minutos por lado, hasta que estén bien cocidos.
3. Acompaña con Arroz primavera.$$),

  ('ave-cubo',
   $$Descongelar en el refrigerador de 8 a 12 horas antes de cocinar. Nunca a temperatura ambiente.$$,
   $$Pollo salteado al wok

Ingredientes:
- 500 g de Ave cubo
- 2 tazas de Primavera
- Salsa de soya
- Ajo y jengibre

Preparación:
1. Dora el pollo a fuego alto.
2. Agrega el ajo, el jengibre y la primavera.
3. Saltea 5 minutos con la soya.$$),

  ('chuleta-vetada',
   $$Descongelar en el refrigerador de 8 a 12 horas antes de cocinar. Nunca a temperatura ambiente.$$,
   $$Chuletas al horno con miel y mostaza

Ingredientes:
- 4 chuletas vetadas
- 2 cucharadas de mostaza
- 2 cucharadas de miel
- Ajo y romero

Preparación:
1. Mezcla la mostaza, la miel, el ajo y el romero.
2. Pincela las chuletas.
3. Hornea a 200 °C por 25 minutos, hasta que estén bien cocidas.
4. Acompaña con Papas prefritas.$$),

  -- ===== Frutas (1 kg) =====
  ('frambuesa',
   $$Para batidos, usar directo congeladas. Para postres, descongelar en el refrigerador. No volver a congelar.$$,
   $$Batido de frambuesa

Ingredientes:
- 1 taza de frambuesas congeladas
- 1 plátano
- 1 taza de leche o yogur

Preparación:
1. Pon todo en la licuadora.
2. Licúa 1 minuto y sirve de inmediato.$$),

  ('arandano',
   $$Para batidos, usar directo congelados. Para postres, descongelar en el refrigerador. No volver a congelar.$$,
   $$Muffins de arándano

Ingredientes:
- 2 tazas de harina
- ¾ taza de azúcar
- 2 huevos
- ½ taza de aceite
- ¾ taza de leche
- 2 cucharaditas de polvo de hornear
- 1 taza de arándanos congelados

Preparación:
1. Mezcla los ingredientes secos y luego los húmedos.
2. Enharina los arándanos sin descongelarlos (así no tiñen la masa) e incorpóralos.
3. Reparte en moldes y hornea a 180 °C por 22 a 25 minutos.$$),

  ('frutilla',
   $$Para batidos, usar directo congeladas. Para postres, descongelar en el refrigerador. No volver a congelar.$$,
   $$Mermelada casera de frutilla

Ingredientes:
- 1 kg de frutillas
- 500 g de azúcar
- Jugo de 1 limón

Preparación:
1. Pon todo en una olla a fuego medio.
2. Cocina 30 a 40 minutos revolviendo, hasta que espese.
3. Envasa en frascos limpios y deja enfriar.$$),

  ('mora',
   $$Para batidos, usar directo congeladas. Para postres, descongelar en el refrigerador. No volver a congelar.$$,
   $$Kuchen de mora

Ingredientes (masa):
- 250 g de harina
- 125 g de mantequilla
- 1 huevo
- 80 g de azúcar

Ingredientes (relleno):
- 500 g de moras
- 2 cucharadas de maicena
- Azúcar a gusto

Preparación:
1. Une los ingredientes de la masa y forra un molde.
2. Mezcla las moras con la maicena y el azúcar, y rellena.
3. Hornea a 180 °C por 40 minutos.$$),

  ('frambuesa-crumble',
   $$Ideal para hornear directo desde congelada.$$,
   $$Crumble de frambuesa

Ingredientes:
- 500 g de frambuesa crumble
- 100 g de harina
- 100 g de avena
- 100 g de azúcar rubia
- 100 g de mantequilla fría

Preparación:
1. Pon la frambuesa en una fuente para horno.
2. Desmenuza con los dedos la harina, la avena, el azúcar y la mantequilla.
3. Cubre la fruta con la mezcla.
4. Hornea a 180 °C por 30 minutos.$$),

  ('mango',
   $$Para batidos, usar directo congelado. Para postres, descongelar en el refrigerador. No volver a congelar.$$,
   $$Lassi de mango

Ingredientes:
- 1 taza de mango
- 1 taza de yogur natural
- ½ taza de leche
- Miel a gusto

Preparación:
1. Licúa todo hasta que quede cremoso.
2. Sirve bien frío.$$),

  ('pina',
   $$Para batidos, usar directo congelada. Para postres, descongelar en el refrigerador. No volver a congelar.$$,
   $$Piña colada sin alcohol

Ingredientes:
- 1 taza de piña
- ½ taza de leche de coco
- ½ taza de jugo de piña
- Hielo

Preparación:
1. Licúa todo con el hielo.
2. Sirve de inmediato.$$),

  ('melon-tuna',
   $$Para batidos, usar directo congelado. Para postres, descongelar en el refrigerador. No volver a congelar.$$,
   $$Agua fresca de melón tuna

Ingredientes:
- 2 tazas de melón tuna
- 1 litro de agua fría
- Jugo de limón y menta
- Endulzante a gusto

Preparación:
1. Licúa el melón con el agua, el limón y la menta.
2. Cuela si lo prefieres y endulza a gusto.$$),

  -- ===== Pulpas de fruta (1 kg) =====
  ('pulpa-frambuesa',
   $$Para jugo, licuar 1 parte de pulpa con 2 a 3 partes de agua fría y endulzar a gusto. Se puede usar semi descongelada.$$,
   $$Mousse de frambuesa

Ingredientes:
- 1 taza de pulpa de frambuesa
- 1 tarro de leche evaporada bien fría
- ½ taza de azúcar
- 1 sobre de gelatina sin sabor

Preparación:
1. Hidrata la gelatina y disuélvela a baño maría.
2. Bate la leche evaporada hasta que espume.
3. Incorpora la pulpa, el azúcar y la gelatina.
4. Refrigera 3 horas.$$),

  ('pulpa-frutilla',
   $$Para jugo, licuar 1 parte de pulpa con 2 a 3 partes de agua fría y endulzar a gusto. Se puede usar semi descongelada.$$,
   $$Frutilla con leche

Ingredientes:
- 1 taza de pulpa de frutilla
- 3 tazas de leche fría
- Azúcar a gusto

Preparación:
1. Licúa todo.
2. Sirve bien frío.$$),

  ('pulpa-mango',
   $$Para jugo, licuar 1 parte de pulpa con 2 a 3 partes de agua fría y endulzar a gusto. Se puede usar semi descongelada.$$,
   $$Sorbete de mango

Ingredientes:
- 500 g de pulpa de mango
- 100 g de azúcar
- Jugo de 1 limón

Preparación:
1. Mezcla todo y lleva al congelador.
2. Raspa con un tenedor cada 30 minutos, 3 veces.
3. Sirve en copas frías.$$),

  ('pulpa-pina',
   $$Para jugo, licuar 1 parte de pulpa con 2 a 3 partes de agua fría y endulzar a gusto. Se puede usar semi descongelada.$$,
   $$Jugo de piña con menta

Ingredientes:
- 1 taza de pulpa de piña
- 3 tazas de agua fría
- Hojas de menta
- Azúcar a gusto

Preparación:
1. Licúa todo.
2. Sirve con hielo.$$),

  ('pulpa-chirimoya',
   $$Para jugo, licuar 1 parte de pulpa con 2 a 3 partes de agua fría y endulzar a gusto. Se puede usar semi descongelada.$$,
   $$Chirimoya alegre

Ingredientes:
- 2 tazas de pulpa de chirimoya
- Jugo de 3 naranjas

Preparación:
1. Deja la pulpa semi descongelada.
2. Mezcla con el jugo de naranja.
3. Sirve en copas bien frías.$$),

  ('pulpa-lucuma',
   $$Para jugo o batido, licuar 1 parte de pulpa con 2 a 3 partes de leche fría y endulzar a gusto. Se puede usar semi descongelada.$$,
   $$Postre rápido de lúcuma

Ingredientes:
- 1 taza de pulpa de lúcuma
- 1 lata de leche condensada
- 1 taza de crema para batir

Preparación:
1. Bate la crema hasta que esté firme.
2. Incorpora la pulpa y la leche condensada con movimientos suaves.
3. Refrigera 4 horas.$$),

  ('pulpa-melon-tuna',
   $$Para jugo, licuar 1 parte de pulpa con 2 a 3 partes de agua fría y endulzar a gusto. Se puede usar semi descongelada.$$,
   $$Granizado de melón tuna

Ingredientes:
- 2 tazas de pulpa de melón tuna
- 1 taza de agua
- 3 cucharadas de azúcar
- Jugo de limón

Preparación:
1. Mezcla todo y lleva al congelador.
2. Raspa con un tenedor cada 30 minutos hasta que quede granizado.$$),

  ('pulpa-mix-tropical',
   $$Para jugo, licuar 1 parte de pulpa con 2 a 3 partes de agua fría y endulzar a gusto. Se puede usar semi descongelada.$$,
   $$Smoothie tropical

Ingredientes:
- 1 taza de pulpa mix tropical
- 1 plátano
- 1 taza de yogur
- ½ taza de jugo de naranja

Preparación:
1. Licúa todo hasta que quede cremoso.
2. Sirve de inmediato.$$),

  ('pulpa-maracuya',
   $$Para jugo, licuar 1 parte de pulpa con 2 a 3 partes de agua fría y endulzar a gusto. Se puede colar para quitar las pepas.$$,
   $$Mousse de maracuyá

Ingredientes:
- 1 taza de pulpa de maracuyá
- 1 lata de leche condensada
- 1 tarro de leche evaporada fría

Preparación:
1. Licúa todo (cuela la pulpa antes si la prefieres sin pepas).
2. Reparte en copas.
3. Refrigera 3 horas.$$)

  ) as v(slug, preparacion, receta)
 where p.slug = v.slug;

-- Avisa a la API de Supabase por si se crearon columnas
notify pgrst, 'reload schema';

-- Verificación: cuántos productos quedaron con preparación y receta
select count(*) as productos,
       count(preparacion) as con_preparacion,
       count(receta) as con_receta,
       count(*) filter (where slug like 'queso-gauda%') as queso_gauda
  from productos where orden > 100;
