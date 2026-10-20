// /api/admin?accion=… → panel de administración protegido con ADMIN_PASSWORD.
//   GET  pedidos[&estado=]   lista los últimos pedidos con su detalle
//   POST estado              { id, estado }
//   GET  productos           todos los productos (activos e inactivos)
//   POST producto            { id?, ...campos } crea o actualiza
import crypto from 'node:crypto';
import { ruta, ErrorPublico, UUID, texto } from './_lib/http.js';
import { sb } from './_lib/supabase.js';

const ESTADOS = ['pendiente_pago', 'pagado', 'rechazado', 'en_preparacion', 'en_camino', 'listo_retiro', 'entregado', 'cancelado'];

function autorizado(req) {
  const clave = process.env.ADMIN_PASSWORD || '';
  if (clave.length < 10) throw new ErrorPublico('Configura ADMIN_PASSWORD (mínimo 10 caracteres) en Vercel.', 503);
  const h = (s) => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(h(String(req.headers['x-admin-clave'] || '')), h(clave));
}

function entero(v, { min = 0, nulo = false } = {}) {
  if (nulo && (v === null || v === undefined || v === '')) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new ErrorPublico('Revisa los valores numéricos.');
  return n;
}

function slugDe(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function porcentaje(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= -100 || n > 10000) throw new ErrorPublico('Revisa el porcentaje de margen.');
  return Math.round(n * 100) / 100;
}

function limpiarProducto(p) {
  const nombre = texto(p.nombre, 120);
  const categoria = texto(p.categoria, 60);
  if (nombre.length < 2) throw new ErrorPublico('El producto necesita un nombre.');
  if (!categoria) throw new ErrorPublico('El producto necesita una categoría.');
  const imagen = texto(p.imagen_url, 500);
  if (imagen && !/^https:\/\//.test(imagen)) throw new ErrorPublico('La imagen debe ser una URL que empiece con https://');
  // Costo y margen solo se tocan si vienen en la solicitud (el diálogo "Editar" no los envía).
  const costos = {};
  if ('costo' in p) costos.costo = entero(p.costo, { nulo: true });
  if ('margen' in p) costos.margen = porcentaje(p.margen);
  return {
    ...costos,
    nombre,
    slug: slugDe(texto(p.slug, 80) || nombre),
    descripcion: texto(p.descripcion, 1000),
    categoria,
    formato: texto(p.formato, 80),
    precio: entero(p.precio),
    precio_anterior: entero(p.precio_anterior, { nulo: true }),
    stock: entero(p.stock),
    imagen_url: imagen || null,
    destacado: Boolean(p.destacado),
    activo: Boolean(p.activo),
    orden: entero(p.orden ?? 0, { min: -100000 }),
  };
}

export default ruta(['GET', 'POST'], async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!autorizado(req)) {
    await new Promise((r) => setTimeout(r, 800)); // frena intentos por fuerza bruta
    throw new ErrorPublico('Clave incorrecta.', 401);
  }
  const accion = `${req.method} ${req.query.accion}`;
  const b = req.body || {};

  switch (accion) {
    case 'GET pedidos': {
      const estado = String(req.query.estado || '');
      const filtro = ESTADOS.includes(estado) ? `&estado=eq.${estado}` : '';
      const pedidos = await sb(
        `pedidos?select=*,puntos_retiro(nombre),pedido_items(nombre,formato,cantidad,precio_unitario,subtotal)&order=creado_en.desc&limit=200${filtro}`
      );
      return res.json(pedidos);
    }
    case 'POST estado': {
      if (!UUID.test(String(b.id)) || !ESTADOS.includes(b.estado)) throw new ErrorPublico('Datos inválidos.');
      const [p] = await sb(`pedidos?id=eq.${b.id}`, {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { estado: b.estado, actualizado_en: new Date().toISOString() },
      });
      return res.json(p);
    }
    case 'GET productos':
      return res.json(await sb('productos?select=*&order=orden.asc,nombre.asc'));
    case 'POST producto': {
      const datos = limpiarProducto(b);
      const id = b.id ? entero(b.id, { min: 1 }) : null;
      try {
        const [p] = id
          ? await sb(`productos?id=eq.${id}`, { method: 'PATCH', prefer: 'return=representation', body: datos })
          : await sb('productos', { method: 'POST', prefer: 'return=representation', body: datos });
        return res.json(p);
      } catch (e) {
        if (String(e.message).includes('23505')) throw new ErrorPublico('Ya existe otro producto con ese nombre (slug repetido).', 409);
        if (/PGRST204|column .*(costo|margen)/.test(String(e.message))) {
          throw new ErrorPublico('Falta crear las columnas de costo y margen: ejecuta supabase/costos.sql en Supabase.', 409);
        }
        throw e;
      }
    }
    default:
      throw new ErrorPublico('Acción desconocida.', 404);
  }
});
