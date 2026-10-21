// GET /api/pedido?id=<uuid>[&payment_id=<id>] → estado público de un pedido.
// Si viene payment_id (Mercado Pago lo agrega al volver) y el pedido sigue pendiente,
// se consulta el pago en el momento por si el webhook aún no llegó.
import { ruta, ErrorPublico, UUID } from './_lib/http.js';
import { sb } from './_lib/supabase.js';
import { procesarPago } from './_lib/mercadopago.js';

const CAMPOS = [
  'numero', 'estado', 'creado_en', 'pagado_en', 'cliente_nombre', 'entrega', 'comuna', 'direccion',
  'subtotal', 'costo_despacho', 'total',
  'pedido_items(nombre,formato,cantidad,precio_unitario,subtotal)',
].join(',');

const leer = async (id) => (await sb(`pedidos?id=eq.${id}&select=${CAMPOS}`))[0];

export default ruta(['GET'], async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = String(req.query.id || '');
  if (!UUID.test(id)) throw new ErrorPublico('Pedido no encontrado.', 404);

  let pedido = await leer(id);
  if (!pedido) throw new ErrorPublico('Pedido no encontrado.', 404);

  const pagoId = String(req.query.payment_id || req.query.collection_id || '');
  if (['pendiente_pago', 'rechazado'].includes(pedido.estado) && /^\d{1,20}$/.test(pagoId)) {
    try {
      const r = await procesarPago(pagoId);
      if (r.pedidoId === id) pedido = await leer(id);
    } catch (e) {
      console.error('Verificación de pago al volver', e);
    }
  }

  // Solo el primer nombre: la página es accesible por cualquiera con el enlace.
  pedido.cliente_nombre = (pedido.cliente_nombre || '').split(' ')[0];
  res.status(200).json(pedido);
});
