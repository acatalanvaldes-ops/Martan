// Cliente mínimo de la API de Mercado Pago y lógica de confirmación de pagos.
import { ErrorPublico, UUID } from './http.js';
import { sb, rpc } from './supabase.js';
import { notificarEstado } from './correo.js';

const MP = 'https://api.mercadopago.com';

// Credenciales de prueba: el Access Token empieza con "TEST-". También se puede forzar con MP_MODO=prueba|produccion.
export function modoPrueba() {
  const forzado = (process.env.MP_MODO || '').toLowerCase();
  if (forzado === 'prueba') return true;
  if (forzado === 'produccion' || forzado === 'producción') return false;
  return (process.env.MP_ACCESS_TOKEN || '').startsWith('TEST-');
}

// Pregunta a Mercado Pago a qué cuenta pertenece el Access Token (sin exponer datos):
// si es un usuario de prueba, los pagos deben hacerse en el entorno de pruebas.
let cuentaCache = null;
export async function cuentaMP() {
  if (cuentaCache) return cuentaCache;
  try {
    const u = await mp('/users/me');
    const etiquetas = u.tags || [];
    cuentaCache = { usuario_prueba: etiquetas.includes('test_user'), pais: u.site_id || null, etiquetas };
  } catch (e) {
    cuentaCache = { error: String(e.message).slice(0, 120) };
  }
  return cuentaCache;
}

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
    // 'ok' solo ocurre la primera vez: el correo de pago confirmado no se duplica.
    if (resultado === 'ok') await notificarEstado(pedidoId);
    return { resultado, pedidoId };
  }

  const cambios = { mp_pago_id: String(pago.id), mp_estado: pago.status, actualizado_en: new Date().toISOString() };
  const fallido = ESTADOS_FALLIDOS.includes(pago.status);
  if (fallido) cambios.estado = 'rechazado';
  // Solo toca pedidos que aún no están pagados. Si pasa de pendiente a rechazado, se avisa al cliente una vez.
  const pasaARechazado = fallido
    ? await sb(`pedidos?id=eq.${pedidoId}&estado=eq.pendiente_pago`, { method: 'PATCH', prefer: 'return=representation', body: cambios })
    : [];
  if (pasaARechazado.length) await notificarEstado(pedidoId);
  else await sb(`pedidos?id=eq.${pedidoId}&estado=in.(pendiente_pago,rechazado)`, { method: 'PATCH', body: cambios });
  return { resultado: pago.status, pedidoId };
}
