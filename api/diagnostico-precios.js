// TEMPORAL: diagnóstico de precios por unidad/kilo (solo datos de catálogo, que ya son públicos). Se elimina después.
import { ruta } from './_lib/http.js';
import { sb } from './_lib/supabase.js';

export default ruta(['GET'], async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const filas = await sb('productos?select=nombre,formato,precio,unidades_por_caja,precio_unidad,margen_unidad,kilos_por_caja,precio_kilo,margen_kilo,activo&order=orden.asc');
  res.json(filas);
});
