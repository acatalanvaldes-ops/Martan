// Cliente mínimo de la API de Mercado Pago y lógica de confirmación de pagos.
import { ErrorPublico, UUID } from './http.js';
import { sb, rpc } from './supabase.js';

const MP = 'https://api.mercadopago.com';

export async function mp(ruta, { method = 'GET', body, idempotencia } = {}) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new ErrorPublico('Los pagos en línea aún no están configurados.', 503);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (idempotencia) headers['X-Idempotency-Key'] = idempotencia;

  const r = await fetch(MP + ruta, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contenido = await r.text();
  if (!r.ok) throw new Error(`Mercado Pago ${r.status} en ${method} ${ruta}: ${contenido.slice(0, 300)}`);
  return contenido ? JSON.parse(contenido) : null;
}

const ESTADOS_FALLIDOS = ['rejected', 'cancelled', 'refunded', 'charged_back'];

// Consulta el pago directamente a Mercado Pago (fuente de verdad) y actualiza el pedido.
// Es idempotente: se puede llamar varias veces con el mismo pago.
export async function procesarPago(pagoId) {
  const pago = await mp(`/v1/payments/${encodeURIComponent(pagoId)}`);
  const pedidoId = pago.external_reference;
  if (!pedidoId || !UUID.test(pedidoId)) return { resultado: 'sin_pedido' };

  if (pago.status === 'approved' && pago.currency_id === 'CLP') {
    const resultado = await rpc('marcar_pedido_pagado', {
      p_pedido: pedidoId,
      p_pago: String(pago.id),
      p_monto: Math.round(pago.transaction_amount),
    });
    return { resultado, pedidoId };
  }

  const cambios = { mp_pago_id: String(pago.id), mp_estado: pago.status, actualizado_en: new Date().toISOString() };
  if (ESTADOS_FALLIDOS.includes(pago.status)) cambios.estado = 'rechazado';
  // Solo toca pedidos que aún no están pagados.
  await sb(`pedidos?id=eq.${pedidoId}&estado=in.(pendiente_pago,rechazado)`, { method: 'PATCH', body: cambios });
  return { resultado: pago.status, pedidoId };
}
