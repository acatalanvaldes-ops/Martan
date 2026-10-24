// POST /api/checkout → valida el carro en el servidor, crea el pedido y la preferencia de Mercado Pago.
import { ruta, ErrorPublico, urlBase, texto, clp } from './_lib/http.js';
import { sb } from './_lib/supabase.js';
import { mp, modoPrueba, cuentaMP } from './_lib/mercadopago.js';
import { normalizarRut } from './_lib/rut.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default ruta(['POST'], async (req, res) => {
  const b = req.body || {};

  // ---- Carro: cada línea es un producto vendido por caja (por mayor) o por kilo (al detalle) ----
  if (!Array.isArray(b.items) || b.items.length === 0) throw new ErrorPublico('Tu carro está vacío.');
  const lineas = new Map(); // "id:modo" → cantidad
  for (const it of b.items.slice(0, 60)) {
    const id = Number(it?.id);
    const cantidad = Number(it?.cantidad);
    const modo = it?.modo === 'kilo' ? 'kilo' : 'caja';
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 999) {
      throw new ErrorPublico('Hay un producto inválido en el carro.');
    }
    const k = `${id}:${modo}`;
    lineas.set(k, (lineas.get(k) || 0) + cantidad);
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
  if (cliente.rut) {
    cliente.rut = normalizarRut(cliente.rut);
    if (!cliente.rut) throw new ErrorPublico('Tu RUT no es válido. Revisa el número y el dígito verificador.');
  }

  // ---- Documento tributario: boleta (sin datos extra) o factura (datos que exige el SII) ----
  const d = b.documento || {};
  const documento = d.tipo === 'factura' ? 'factura' : 'boleta';
  let factura = {};
  if (documento === 'factura') {
    factura = {
      factura_razon_social: texto(d.razon_social, 150),
      factura_rut: normalizarRut(d.rut),
      factura_giro: texto(d.giro, 150),
      factura_direccion: texto(d.direccion, 200),
      factura_comuna: texto(d.comuna, 80),
      factura_email: texto(d.email, 160).toLowerCase() || cliente.email,
    };
    if (factura.factura_razon_social.length < 3) throw new ErrorPublico('Ingresa la razón social para la factura.');
    if (!factura.factura_rut) throw new ErrorPublico('El RUT de la empresa no es válido. Revisa el número y el dígito verificador.');
    if (factura.factura_giro.length < 3) throw new ErrorPublico('Ingresa el giro de la empresa para la factura.');
    if (factura.factura_direccion.length < 5) throw new ErrorPublico('Ingresa la dirección comercial para la factura.');
    if (!factura.factura_comuna) throw new ErrorPublico('Ingresa la comuna de la dirección comercial.');
    if (!EMAIL.test(factura.factura_email)) throw new ErrorPublico('Ingresa un correo válido para enviar la factura.');
  }

  // Martan solo trabaja con despacho a domicilio.
  const e = b.entrega || {};

  // ---- Precios y stock desde la base de datos (nunca desde el navegador) ----
  // El stock va en kilos si el producto tiene kilos_por_caja (una caja descuenta sus kilos); si no, en cajas.
  const ids = [...new Set([...lineas.keys()].map((k) => Number(k.split(':')[0])))];
  const [productos, conf] = await Promise.all([
    sb(`productos?id=in.(${ids.join(',')})&activo=eq.true&select=id,nombre,formato,precio,stock,kilos_por_caja,precio_kilo,kilos_por_bolsa`),
    sb('configuracion?id=eq.1&select=monto_minimo,despacho_gratis_desde'),
  ]);
  const config = conf[0] || {};
  const porId = new Map(productos.map((p) => [p.id, p]));
  const sinStock = [];
  const items = [];
  const usadas = new Map(); // stock pedido por producto (kilos o cajas, sumando caja + kilo)
  const kg = (n) => Number(n).toLocaleString('es-CL', { maximumFractionDigits: 3 });
  let subtotal = 0;
  for (const [k, cantidad] of lineas) {
    const [idTxt, modo] = k.split(':');
    const id = Number(idTxt);
    const p = porId.get(id);
    if (!p) { sinStock.push({ id, modo, nombre: null, disponible: 0 }); continue; }
    const kilos = Number(p.kilos_por_caja) > 0 ? Number(p.kilos_por_caja) : null;
    const porCaja = kilos || 1;
    if (modo === 'kilo' && !(kilos > 1 && p.precio_kilo > 0)) {
      throw new ErrorPublico(`${p.nombre} solo se vende por caja.`);
    }
    // Detalle por bolsa cerrada: precio = precio por kilo × kilos de la bolsa (redondeado a $10), igual que en la tienda.
    const bolsa = Number(p.kilos_por_bolsa) > 0 ? Number(p.kilos_por_bolsa) : null;
    const precio = modo !== 'kilo' ? p.precio : bolsa ? Math.round((p.precio_kilo * bolsa) / 10) * 10 : p.precio_kilo;
    const unidades = Math.round(cantidad * (modo === 'kilo' ? bolsa || 1 : porCaja) * 1000) / 1000;
    usadas.set(id, (usadas.get(id) || 0) + unidades);
    const formato = modo === 'kilo'
      ? (bolsa ? `Bolsa ${bolsa < 1 ? `${Math.round(bolsa * 1000)} g` : `${kg(bolsa)} kg`} (${kg(unidades)} kg en total) · precio al detalle` : `${cantidad} kg · precio al detalle`)
      : `Caja${kilos ? ` de ${kg(kilos)} kg` : (p.formato ? ` · ${p.formato}` : '')} · precio por mayor`;
    items.push({ producto_id: id, nombre: p.nombre, formato, modo, unidades, precio_unitario: precio, cantidad, subtotal: precio * cantidad });
    subtotal += precio * cantidad;
  }
  for (const [id, unidades] of usadas) {
    const p = porId.get(id);
    if (Number(p.stock) < unidades) {
      const kilos = Number(p.kilos_por_caja) > 0 ? Number(p.kilos_por_caja) : null;
      sinStock.push({ id, nombre: p.nombre, disponible: Number(p.stock), cajas: Math.floor(Number(p.stock) / (kilos || 1)), kilos_por_caja: kilos });
    }
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
      documento,
      ...factura,
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
  // Modo prueba: token de prueba clásico (TEST-) o cuenta de Mercado Pago marcada como usuario de prueba.
  const prueba = modoPrueba() || Boolean((await cuentaMP()).usuario_prueba);
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
        // En prueba no se envía el comprador: Mercado Pago bloquea el pago si no coincide con la cuenta de prueba que inició sesión.
        ...(prueba ? {} : { payer: { name: cliente.nombre, email: cliente.email } }),
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
  const urlPago = prueba && preferencia.sandbox_init_point ? preferencia.sandbox_init_point : preferencia.init_point;
  res.status(201).json({ pedidoId: pedido.id, numero: pedido.numero, urlPago });
});
