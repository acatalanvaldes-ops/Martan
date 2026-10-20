// GET /api/catalogo → productos activos, zonas de despacho, puntos de retiro y configuración.
import { ruta } from './_lib/http.js';
import { sb } from './_lib/supabase.js';

export default ruta(['GET'], async (req, res) => {
  const [productos, zonas, puntos, config] = await Promise.all([
    sb('productos?activo=eq.true&select=id,slug,nombre,descripcion,categoria,formato,precio,precio_anterior,stock,imagen_url,destacado&order=orden.asc,nombre.asc'),
    sb('zonas_despacho?activo=eq.true&select=comuna,costo&order=comuna.asc'),
    sb('puntos_retiro?activo=eq.true&select=id,nombre,direccion,horario&order=id.asc'),
    sb('configuracion?id=eq.1&select=monto_minimo,despacho_gratis_desde,whatsapp,email_contacto'),
  ]);
  // Caché corto en el CDN; el stock se vuelve a validar al pagar.
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
  res.status(200).json({ productos, zonas, puntos, config: config[0] || {} });
});
