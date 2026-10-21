// POST /api/contacto → guarda un mensaje del formulario de contacto (se revisa en /admin → Mensajes).
import { ruta, ErrorPublico, texto } from './_lib/http.js';
import { sb } from './_lib/supabase.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIPOS = ['sugerencia', 'reclamo', 'cotizacion', 'factura'];

// Valida un RUT chileno (dígito verificador, módulo 11) y lo devuelve como 12.345.678-9.
export function normalizarRut(valor) {
  const limpio = String(valor || '').replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length < 2 || limpio.length > 9) return null;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  if (dv !== esperado) return null;
  return `${Number(cuerpo).toLocaleString('es-CL')}-${dv}`;
}

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
