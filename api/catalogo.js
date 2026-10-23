// GET /api/catalogo → productos activos, comunas de despacho y configuración.
import { ruta } from './_lib/http.js';
import { sb } from './_lib/supabase.js';

const CAMPOS = 'id,slug,nombre,descripcion,categoria,formato,precio,precio_anterior,stock,imagen_url,destacado';
const CAMPOS_FICHA = `${CAMPOS},imagenes,temporada,conservacion,preparacion,receta,unidades_por_caja,precio_unidad,formato_unidad`;
const orden = '&order=orden.asc,nombre.asc';

// Si aún no se ejecutó supabase/fichas.sql, la tienda sigue funcionando sin las columnas de la ficha.
async function productosActivos() {
  try {
    return await sb(`productos?activo=eq.true&select=${CAMPOS_FICHA}${orden}`);
  } catch (e) {
    if (!/PGRST204|42703|does not exist|column/i.test(String(e.message))) throw e;
    console.warn('catalogo: faltan columnas de ficha, usando campos básicos');
    return sb(`productos?activo=eq.true&select=${CAMPOS}${orden}`);
  }
}

export default ruta(['GET'], async (req, res) => {
  const [productos, zonas, config] = await Promise.all([
    productosActivos(),
    sb('zonas_despacho?activo=eq.true&select=comuna,costo&order=comuna.asc'),
    sb('configuracion?id=eq.1&select=monto_minimo,despacho_gratis_desde,whatsapp,email_contacto'),
  ]);
  // Caché corto en el CDN; el stock se vuelve a validar al pagar.
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
  res.status(200).json({ productos, zonas, config: config[0] || {} });
});
