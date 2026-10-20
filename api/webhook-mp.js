// POST /api/webhook-mp → notificaciones de Mercado Pago.
// Nunca se confía en el contenido de la notificación: se consulta el pago a la API de MP.
import crypto from 'node:crypto';
import { procesarPago } from './_lib/mercadopago.js';

function firmaValida(req, dataId, secreto) {
  const firma = String(req.headers['x-signature'] || '');
  const requestId = req.headers['x-request-id'];
  const partes = Object.fromEntries(
    firma.split(',').map((p) => p.split('=').map((s) => s.trim())).filter((p) => p.length === 2)
  );
  if (!partes.ts || !partes.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifiesto = `id:${id};${requestId ? `request-id:${requestId};` : ''}ts:${partes.ts};`;
  const esperado = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex');
  const a = Buffer.from(esperado);
  const b = Buffer.from(partes.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

  const q = req.query || {};
  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const tipo = q.type || b.type || q.topic || b.topic;
  const dataId = String(q['data.id'] || b.data?.id || q.id || '');

  if (tipo !== 'payment' || !/^\d{1,20}$/.test(dataId)) {
    return res.status(200).json({ ok: true, ignorado: true });
  }

  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (secreto && req.headers['x-signature'] && !firmaValida(req, dataId, secreto)) {
    console.warn('webhook-mp: firma inválida', dataId);
    return res.status(401).json({ error: 'Firma inválida' });
  }

  try {
    const r = await procesarPago(dataId);
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    console.error('webhook-mp', e);
    // 500 hace que Mercado Pago reintente la notificación más tarde.
    return res.status(500).json({ error: 'Reintentar' });
  }
}
