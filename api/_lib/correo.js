// Correos al cliente cuando cambia el estado de su pedido (vía Resend: https://resend.com).
// Si RESEND_API_KEY no está configurada, no se envía nada y la tienda sigue funcionando.
import { sb } from './supabase.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clp = (n) => '$' + Math.round(n || 0).toLocaleString('es-CL');

export async function enviarCorreo({ para, asunto, html, texto, responderA }) {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return { enviado: false, motivo: 'correo_no_configurado' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Martan Congelados <administracion@martan.cl>',
      to: [para],
      subject: asunto,
      html,
      text: texto,
      ...(responderA ? { reply_to: responderA } : {}),
    }),
  });
  if (!r.ok) {
    const detalle = (await r.text()).slice(0, 300);
    console.error('correo: Resend', r.status, detalle);
    return { enviado: false, motivo: `resend_${r.status}`, detalle };
  }
  return { enviado: true };
}

// Texto de cada estado: [asunto, título, mensaje]
function textos(p) {
  const n = `Pedido N° ${p.numero}`;
  switch (p.estado) {
    case 'pagado':         return [`${n}: ¡recibimos tu pago!`, '¡Gracias por tu compra!', 'Tu pago fue aprobado y tu pedido quedó confirmado. Te avisaremos por este medio cuando comencemos a prepararlo.'];
    case 'rechazado':      return [`${n}: el pago no se completó`, 'Tu pago no se completó', 'Mercado Pago rechazó o canceló el pago. Tu carro sigue guardado en la tienda: puedes intentarlo de nuevo con otro medio de pago.'];
    case 'en_preparacion': return [`${n}: estamos preparando tu pedido`, 'Estamos preparando tu pedido', 'Ya estamos armando tu pedido, manteniendo la cadena de frío.'];
    case 'en_camino':      return [`${n}: tu pedido va en camino`, 'Tu pedido va en camino', 'Nuestro despacho ya salió hacia tu dirección. Mantén espacio en el congelador: guarda los productos apenas los recibas (−18 °C).'];
    case 'entregado':      return [`${n}: pedido entregado`, '¡Pedido entregado!', '¡Que lo disfrutes! Gracias por comprar en Martan Congelados. Si algo no llegó como esperabas, escríbenos desde la página de contacto.'];
    case 'cancelado':      return [`${n}: pedido cancelado`, 'Tu pedido fue cancelado', 'Si crees que se trata de un error o tienes dudas, responde este correo o escríbenos desde la página de contacto.'];
    default:               return null;
  }
}

function plantilla(p, titulo, mensaje, enlace) {
  const filas = (p.pedido_items || []).map((i) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e6eff2;color:#0b2440">${i.cantidad} × ${esc(i.nombre)}${i.formato ? `<br><span style="color:#52677c;font-size:13px">${esc(i.formato)}</span>` : ''}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e6eff2;text-align:right;color:#0b2440;white-space:nowrap">${clp(i.subtotal)}</td>
    </tr>`).join('');
  return `<!doctype html><html lang="es"><body style="margin:0;background:#e6eff2;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e6eff2;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
        <tr><td style="background:#033360;padding:22px 28px;text-align:center">
          <div style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:5px">MARTAN</div>
          <div style="color:#ffffff;font-size:11px;letter-spacing:5px;margin-top:4px">CONGELADOS</div>
        </td></tr>
        <tr><td style="height:4px;background:#E99A00"></td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 4px;color:#0D96B3;font-size:12px;font-weight:700;letter-spacing:2px">PEDIDO N° ${p.numero}</p>
          <h1 style="margin:0 0 12px;color:#033360;font-size:22px">${esc(titulo)}</h1>
          <p style="margin:0 0 20px;color:#2d3b4b;font-size:15px;line-height:1.5">Hola ${esc((p.cliente_nombre || '').split(' ')[0])}, ${esc(mensaje.charAt(0).toLowerCase() + mensaje.slice(1))}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${filas}
            <tr><td style="padding:8px 0;color:#52677c">Despacho</td><td style="padding:8px 0;text-align:right;color:#52677c">${p.costo_despacho ? clp(p.costo_despacho) : 'Gratis'}</td></tr>
            <tr><td style="padding:8px 0;font-weight:700;color:#033360">Total</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#033360">${clp(p.total)}</td></tr>
          </table>
          <p style="margin:18px 0 0;color:#52677c;font-size:13px">Despacho a: ${esc(p.direccion)}, ${esc(p.comuna)}</p>
          <p style="margin:24px 0 0;text-align:center">
            <a href="${enlace}" style="display:inline-block;background:#E99A00;color:#033360;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:10px">Ver mi pedido</a>
          </p>
        </td></tr>
        <tr><td style="background:#f4f8fa;padding:16px 28px;text-align:center;color:#52677c;font-size:12px">
          Comercial Martan SpA · <a href="https://www.martan.cl" style="color:#033360">www.martan.cl</a>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

// Envía al cliente el correo del estado actual de su pedido. Nunca lanza error: devuelve el resultado.
export async function notificarEstado(pedidoId) {
  try {
    const [p] = await sb(`pedidos?id=eq.${pedidoId}&select=id,numero,estado,cliente_nombre,cliente_email,direccion,comuna,costo_despacho,total,pedido_items(nombre,formato,cantidad,subtotal)`);
    if (!p) return { enviado: false, motivo: 'pedido_no_encontrado' };
    const t = textos(p);
    if (!t) return { enviado: false, motivo: 'estado_sin_correo' };
    const [asunto, titulo, mensaje] = t;
    const base = (process.env.SITE_URL || 'https://www.martan.cl').replace(/\/$/, '');
    const enlace = `${base}/pedido?id=${p.id}`;
    const [conf] = await sb('configuracion?id=eq.1&select=email_contacto').catch(() => [{}]);
    const texto = `${titulo}\n\nHola ${(p.cliente_nombre || '').split(' ')[0]}, ${mensaje}\n\n` +
      (p.pedido_items || []).map((i) => `${i.cantidad} × ${i.nombre} — ${clp(i.subtotal)}`).join('\n') +
      `\nDespacho: ${p.costo_despacho ? clp(p.costo_despacho) : 'Gratis'}\nTotal: ${clp(p.total)}\n\nVer tu pedido: ${enlace}\n\nMartan Congelados · www.martan.cl`;
    return await enviarCorreo({ para: p.cliente_email, asunto, html: plantilla(p, titulo, mensaje, enlace), texto, responderA: process.env.MAIL_REPLY_TO || conf?.email_contacto || 'administracion@martan.cl' });
  } catch (e) {
    console.error('notificarEstado', e);
    return { enviado: false, motivo: 'error', detalle: String(e.message).slice(0, 200) };
  }
}
