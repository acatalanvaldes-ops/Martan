// POST /api/checkout → valida el carro en el servidor, crea el pedido y la preferencia de Mercado Pago.
import { ruta, ErrorPublico, urlBase, texto, clp } from './_lib/http.js';
import { sb } from './_lib/supabase.js';
import { mp, modoPrueba } from './_lib/mercadopago.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default ruta(['POST'], async (req, res) => {
  const b = req.body || {};

  // ---- Carro: se agrupan cantidades por producto ----
  if (!Array.isArray(b.items) || b.items.length === 0) throw new ErrorPublico('Tu carro está vacío.');
  const cantidades = new Map();
  for (const it of b.items.slice(0, 60)) {
    const id = Number(it?.id);
    const cantidad = Number(it?.cantidad);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 99) {
      throw new ErrorPublico('Hay un producto inválido en el carro.');
    }
    cantidades.set(id, (cantidades.get(id) || 0) + cantidad);
  }

  // ---- Cliente ----
  const c = b.cliente || {};
  const cliente = {
    nombre: texto(c.nombre, 120),
    email: texto(c.email, 160).toLowerCase(),
    telefono: texto(c.telefono, 30),
    rut: texto(c.rut, 15),
  };
  if (cliente.nombre.length < 3) throw new ErrorPublico('Ingresa tu nombre completo.');
  if (!EMAIL.test(cliente.email)) throw new ErrorPublico('Ingresa un correo válido.');
  if (cliente.telefono.replace(/\D/g, '').length < 8) throw new ErrorPublico('Ingresa un teléfono válido.');

  // Martan solo trabaja con despacho a domicilio.
  const e = b.entrega || {};

  // ---- Precios y stock desde la base de datos (nunca desde el navegador) ----
  const ids = [...cantidades.keys()];
  const [productos, conf] = await Promise.all([
    sb(`productos?id=in.(${ids.join(',')})&activo=eq.true&select=id,nombre,formato,precio,stock`),
    sb('configuracion?id=eq.1&select=monto_minimo,despacho_gratis_desde'),
  ]);
  const config = conf[0] || {};
  const porId = new Map(productos.map((p) => [p.id, p]));
  const sinStock = [];
  const items = [];
  let subtotal = 0;
  for (const [id, cantidad] of cantidades) {
    const p = porId.get(id);
    if (!p || p.stock < cantidad) {
      sinStock.push({ id, nombre: p?.nombre ?? null, disponible: p?.stock ?? 0 });
      continue;
    }
    items.push({
      producto_id: id,
      nombre: p.nombre,
      formato: p.formato,
      precio_unitario: p.precio,
      cantidad,
      subtotal: p.precio * cantidad,
    });
    subtotal += p.precio * cantidad;
  }
  if (sinStock.length) throw new ErrorPublico('Algunos productos ya no tienen stock suficiente.', 409, { sinStock });
  if (config.monto_minimo && subtotal < config.monto_minimo) {
    throw new ErrorPublico(`El monto mínimo de compra es ${clp(config.monto_minimo)}.`);
  }

  // ---- Despacho ----
  const comuna = texto(e.comuna, 80);
  const direccion = texto(e.direccion, 200);
  if (direccion.length < 5) throw new ErrorPublico('Ingresa la dirección de despacho.');
  const [zona] = await sb(`zonas_despacho?activo=eq.true&comuna=eq.${encodeURIComponent(comuna)}&select=comuna,costo`);
  if (!zona) throw new ErrorPublico('Aún no despachamos a esa comuna.');
  const gratis = config.despacho_gratis_desde && subtotal >= config.despacho_gratis_desde;
  const costoDespacho = gratis ? 0 : zona.costo;
  const entrega = { comuna: zona.comuna, direccion, referencia: texto(e.referencia, 200) };
  const total = subtotal + costoDespacho;

  // ---- Pedido ----
  const [pedido] = await sb('pedidos', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      cliente_nombre: cliente.nombre,
      cliente_email: cliente.email,
      cliente_telefono: cliente.telefono,
      cliente_rut: cliente.rut || null,
      entrega: 'despacho',
      ...entrega,
      notas: texto(b.notas, 500) || null,
      subtotal,
      costo_despacho: costoDespacho,
      total,
    },
  });
  await sb('pedido_items', { method: 'POST', body: items.map((i) => ({ ...i, pedido_id: pedido.id })) });

  // ---- Preferencia de pago ----
  const base = urlBase(req);
  const vuelta = `${base}/pedido?id=${pedido.id}`;
  let preferencia;
  try {
    preferencia = await mp('/checkout/preferences', {
      method: 'POST',
      idempotencia: pedido.id,
      body: {
        items: [
          ...items.map((i) => ({
            id: String(i.producto_id),
            title: (i.formato ? `${i.nombre} (${i.formato})` : i.nombre).slice(0, 250),
            quantity: i.cantidad,
            unit_price: i.precio_unitario,
            currency_id: 'CLP',
          })),
          ...(costoDespacho
            ? [{ id: 'despacho', title: `Despacho a ${entrega.comuna}`, quantity: 1, unit_price: costoDespacho, currency_id: 'CLP' }]
            : []),
        ],
        payer: { name: cliente.nombre, email: cliente.email },
        external_reference: pedido.id,
        back_urls: { success: vuelta, failure: vuelta, pending: vuelta },
        auto_return: 'approved',
        notification_url: `${base}/api/webhook-mp`,
        statement_descriptor: 'MARTAN',
        expires: true,
        expiration_date_to: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    await sb(`pedidos?id=eq.${pedido.id}`, { method: 'PATCH', body: { estado: 'cancelado', mp_estado: 'error_preferencia' } }).catch(() => {});
    if (err instanceof ErrorPublico) throw err;
    throw new ErrorPublico('No pudimos conectar con Mercado Pago. Intenta nuevamente en unos minutos.', 502);
  }

  await sb(`pedidos?id=eq.${pedido.id}`, { method: 'PATCH', body: { mp_preferencia_id: preferencia.id } });
  // Con credenciales de prueba se paga en el entorno de pruebas (sandbox); con las de producción, en el real.
  const urlPago = modoPrueba() && preferencia.sandbox_init_point ? preferencia.sandbox_init_point : preferencia.init_point;
  res.status(201).json({ pedidoId: pedido.id, numero: pedido.numero, urlPago });
});
