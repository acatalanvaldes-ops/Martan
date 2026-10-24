// POST /api/contacto → guarda un mensaje del formulario de contacto (se revisa en /admin → Mensajes).
import { ruta, ErrorPublico, texto } from './_lib/http.js';
import { sb } from './_lib/supabase.js';
import { normalizarRut } from './_lib/rut.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIPOS = ['sugerencia', 'reclamo', 'cotizacion', 'factura'];

export { normalizarRut };

export default ruta(['POST'], async (req, res) => {
  const b = req.body || {};
  // Campo trampa: los humanos no lo ven; los bots suelen llenarlo.
  if (b.web) return res.status(200).json({ ok: true });

  const tipo = String(b.tipo || '');
  if (!TIPOS.includes(tipo)) throw new ErrorPublico('Elige el tipo de contacto.');
  const nombre = texto(b.nombre, 120);
  if (nombre.length < 3) throw new ErrorPublico('Ingresa tu nombre.');
  const rut = normalizarRut(b.rut);
  if (!rut) throw new ErrorPublico('El RUT no es válido. Revisa el número y el dígito verificador.');
  const email = texto(b.email, 160).toLowerCase();
  if (!EMAIL.test(email)) throw new ErrorPublico('Ingresa un correo válido.');
  const mensaje = texto(b.mensaje, 3000);
  if (mensaje.length < 10) throw new ErrorPublico('Cuéntanos un poco más en el mensaje (mínimo 10 caracteres).');
  const pedido = String(b.pedido || '').replace(/\D/g, '');

  // Límite simple contra abuso: máximo 5 mensajes por correo en una hora.
  const desde = new Date(Date.now() - 3600 * 1000).toISOString();
  const recientes = await sb(`contactos?email=eq.${encodeURIComponent(email)}&creado_en=gte.${desde}&select=id`);
  if (recientes.length >= 5) throw new ErrorPublico('Recibimos varios mensajes tuyos recién. Intenta nuevamente en un rato.', 429);

  await sb('contactos', {
    method: 'POST',
    body: {
      tipo, nombre, rut, email, mensaje,
      telefono: texto(b.telefono, 30) || null,
      pedido_numero: pedido ? Number(pedido.slice(0, 12)) : null,
    },
  });
  res.status(201).json({ ok: true });
});
