// /api/admin?accion=… → panel de administración protegido con ADMIN_PASSWORD.
//   GET  pedidos[&estado=]   lista los últimos pedidos con su detalle
//   POST estado              { id, estado }
//   GET  productos           todos los productos (activos e inactivos)
//   POST producto            { id?, ...campos } crea o actualiza
//   POST eliminar            { id }
//   POST foto                { id, imagen: dataURL }   agrega una foto a la galería
//   POST foto-quitar         { id, url }               quita una foto de la galería
//   POST foto-principal      { id, url }               la deja como foto principal
import crypto from 'node:crypto';
import { ruta, ErrorPublico, UUID, texto } from './_lib/http.js';
import { sb, subirArchivo } from './_lib/supabase.js';
import { notificarEstado } from './_lib/correo.js';

const ESTADOS = ['pendiente_pago', 'pagado', 'rechazado', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'];
const ESTADOS_MENSAJE = ['nuevo', 'en_proceso', 'cerrado'];
const MAX_FOTOS = 8;

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

// Número con hasta 3 decimales (kilos). Acepta coma decimal.
function decimal(v, { nulo = false, positivo = false } = {}) {
  if (v === null || v === undefined || v === '') {
    if (nulo) return null;
    throw new ErrorPublico('Revisa los valores numéricos.');
  }
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || (positivo && n === 0)) throw new ErrorPublico('Revisa los valores numéricos (stock y kilos).');
  return Math.round(n * 1000) / 1000;
}

function porcentaje(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= -100 || n > 10000) throw new ErrorPublico('Revisa el porcentaje de margen.');
  return Math.round(n * 100) / 100;
}

// Texto opcional: vacío se guarda como null.
const opcional = (v, max) => texto(v, max) || null;

const CAMPOS_FICHA = { temporada: 120, conservacion: 500, preparacion: 1500, receta: 4000 };

function limpiarProducto(p) {
  const nombre = texto(p.nombre, 120);
  const categoria = texto(p.categoria, 60);
  if (nombre.length < 2) throw new ErrorPublico('El producto necesita un nombre.');
  if (!categoria) throw new ErrorPublico('El producto necesita una categoría.');
  const imagen = texto(p.imagen_url, 500);
  if (imagen && !/^https:\/\//.test(imagen)) throw new ErrorPublico('La imagen debe ser una URL que empiece con https://');
  // Costo, margen y ficha solo se tocan si vienen en la solicitud.
  const extra = {};
  if ('costo' in p) extra.costo = entero(p.costo, { nulo: true });
  if ('margen' in p) extra.margen = porcentaje(p.margen);
  // Venta por kilo (al detalle): kilos que trae la caja, precio por kilo y su margen.
  if ('kilos_por_caja' in p) extra.kilos_por_caja = decimal(p.kilos_por_caja, { nulo: true, positivo: true });
  if ('precio_kilo' in p) extra.precio_kilo = entero(p.precio_kilo, { nulo: true });
  if ('kilos_por_bolsa' in p) extra.kilos_por_bolsa = decimal(p.kilos_por_bolsa, { nulo: true, positivo: true });
  if ('margen_kilo' in p) extra.margen_kilo = porcentaje(p.margen_kilo);
  // Comisión del cobro con tarjeta, en % sobre el precio neto (vacío = 3,19%).
  if ('comision' in p) {
    const c = p.comision === '' || p.comision == null ? 3.19 : Number(String(p.comision).replace(',', '.'));
    if (!Number.isFinite(c) || c < 0 || c >= 50) throw new ErrorPublico('Revisa el porcentaje de comisión (entre 0 y 50).');
    extra.comision = Math.round(c * 100) / 100;
  }
  // Error típico: escribir la cantidad de bolsas (ej. 40) en vez del peso de cada bolsa (0,15 kg).
  if (extra.kilos_por_bolsa && extra.kilos_por_caja && extra.kilos_por_bolsa > extra.kilos_por_caja) {
    throw new ErrorPublico(`«Kg por bolsa» es el peso de una bolsa en kilos (ej. 150 g = 0.15), no la cantidad de bolsas. No puede ser mayor que los kilos por caja (${extra.kilos_por_caja}).`);
  }
  for (const [campo, max] of Object.entries(CAMPOS_FICHA)) {
    if (campo in p) extra[campo] = opcional(p[campo], max);
  }
  return {
    ...extra,
    nombre,
    slug: slugDe(texto(p.slug, 80) || nombre),
    descripcion: texto(p.descripcion, 1000),
    categoria,
    formato: texto(p.formato, 80),
    precio: entero(p.precio),
    precio_anterior: entero(p.precio_anterior, { nulo: true }),
    stock: decimal(p.stock ?? 0), // kilos (admite decimales) o cajas
    imagen_url: imagen || null,
    destacado: Boolean(p.destacado),
    activo: Boolean(p.activo),
    orden: entero(p.orden ?? 0, { min: -100000 }),
  };
}

// Traduce "columna inexistente" en un mensaje que diga qué script falta ejecutar.
async function conColumnas(fn) {
  try {
    return await fn();
  } catch (e) {
    const m = String(e.message);
    if (/PGRST204|42703|does not exist/.test(m)) {
      if (/costo|margen/.test(m)) throw new ErrorPublico('Faltan las columnas de costo y margen: ejecuta supabase/costos.sql en Supabase.', 409);
      if (/kilos_por_caja|precio_kilo|margen_kilo|kilos_por_bolsa|comision|modo|unidades/.test(m)) {
        throw new ErrorPublico('Falta aplicar la migración de venta por caja/kilo (se aplica sola en el próximo deploy).', 409);
      }
      if (/imagenes|temporada|conservacion|preparacion|receta/.test(m)) {
        throw new ErrorPublico('Faltan las columnas de la ficha: ejecuta supabase/fichas.sql en Supabase.', 409);
      }
    }
    throw e;
  }
}

const actualizar = (id, cambios) =>
  conColumnas(() => sb(`productos?id=eq.${id}`, { method: 'PATCH', prefer: 'return=representation', body: cambios }))
    .then(([p]) => p);

async function galeriaDe(id) {
  const [p] = await conColumnas(() => sb(`productos?id=eq.${id}&select=id,slug,imagen_url,imagenes`));
  if (!p) throw new ErrorPublico('Producto no encontrado.', 404);
  return { ...p, fotos: [p.imagen_url, ...(p.imagenes || [])].filter(Boolean) };
}

// La primera foto de la lista es la principal (imagen_url); el resto va en "imagenes".
const guardarGaleria = (id, fotos) => actualizar(id, { imagen_url: fotos[0] || null, imagenes: fotos.slice(1) });

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
        `pedidos?select=*,pedido_items(nombre,formato,modo,cantidad,precio_unitario,subtotal)&order=creado_en.desc&limit=200${filtro}`
      );
      return res.json(pedidos);
    }
    case 'POST estado': {
      if (!UUID.test(String(b.id)) || !ESTADOS.includes(b.estado)) throw new ErrorPublico('Datos inválidos.');
      const [antes] = await sb(`pedidos?id=eq.${b.id}&select=estado`);
      if (!antes) throw new ErrorPublico('Pedido no encontrado.', 404);
      const [p] = await sb(`pedidos?id=eq.${b.id}`, {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { estado: b.estado, actualizado_en: new Date().toISOString() },
      });
      // Cada cambio real de estado se avisa al cliente por correo.
      const correo = antes.estado !== b.estado ? await notificarEstado(b.id) : { enviado: false, motivo: 'sin_cambio' };
      return res.json({ ...p, correo });
    }
    case 'GET productos':
      return res.json(await sb('productos?select=*&order=orden.asc,nombre.asc'));
    case 'POST producto': {
      const datos = limpiarProducto(b);
      const id = b.id ? entero(b.id, { min: 1 }) : null;
      try {
        const [p] = await conColumnas(() => (id
          ? sb(`productos?id=eq.${id}`, { method: 'PATCH', prefer: 'return=representation', body: datos })
          : sb('productos', { method: 'POST', prefer: 'return=representation', body: datos })));
        return res.json(p);
      } catch (e) {
        if (String(e.message).includes('23505')) throw new ErrorPublico('Ya existe otro producto con ese nombre (slug repetido).', 409);
        throw e;
      }
    }
    case 'POST eliminar': {
      // Borra el producto. Los pedidos antiguos guardan nombre, formato y precio en pedido_items,
      // así que solo se desvincula la referencia (producto_id = null) y el historial queda intacto.
      const id = entero(b.id, { min: 1 });
      await sb(`pedido_items?producto_id=eq.${id}`, { method: 'PATCH', body: { producto_id: null } });
      const borrados = await sb(`productos?id=eq.${id}`, { method: 'DELETE', prefer: 'return=representation' });
      if (!borrados.length) throw new ErrorPublico('Producto no encontrado.', 404);
      return res.json({ ok: true, id });
    }
    case 'POST foto': {
      const id = entero(b.id, { min: 1 });
      const g = await galeriaDe(id);
      if (g.fotos.length >= MAX_FOTOS) throw new ErrorPublico(`Máximo ${MAX_FOTOS} fotos por producto.`);
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.imagen || ''));
      if (!m) throw new ErrorPublico('El archivo debe ser una imagen JPG, PNG o WEBP.');
      const contenido = Buffer.from(m[2], 'base64');
      if (contenido.length > 3 * 1024 * 1024) throw new ErrorPublico('La imagen es demasiado grande (máximo 3 MB).');
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[m[1]];
      // Nombre con marca de tiempo: cada foto es única y el navegador nunca muestra una antigua desde caché.
      const url = await subirArchivo('productos', `${g.slug}-${Date.now()}.${ext}`, contenido, m[1]);
      return res.json(await guardarGaleria(id, [...g.fotos, url]));
    }
    case 'POST foto-quitar': {
      const id = entero(b.id, { min: 1 });
      const g = await galeriaDe(id);
      return res.json(await guardarGaleria(id, g.fotos.filter((f) => f !== b.url)));
    }
    case 'POST foto-principal': {
      const id = entero(b.id, { min: 1 });
      const g = await galeriaDe(id);
      if (!g.fotos.includes(b.url)) throw new ErrorPublico('Esa foto no pertenece al producto.', 404);
      return res.json(await guardarGaleria(id, [b.url, ...g.fotos.filter((f) => f !== b.url)]));
    }
    case 'GET mensajes': {
      const estado = String(req.query.estado || '');
      const filtro = ESTADOS_MENSAJE.includes(estado) ? `&estado=eq.${estado}` : '';
      try {
        return res.json(await sb(`contactos?select=*&order=creado_en.desc&limit=300${filtro}`));
      } catch (e) {
        if (/PGRST205|42P01|contactos/.test(String(e.message))) {
          throw new ErrorPublico('Falta crear la tabla de mensajes: ejecuta supabase/contactos.sql en Supabase.', 409);
        }
        throw e;
      }
    }
    case 'POST mensaje-estado': {
      const id = entero(b.id, { min: 1 });
      if (!ESTADOS_MENSAJE.includes(b.estado)) throw new ErrorPublico('Estado inválido.');
      const [m] = await sb(`contactos?id=eq.${id}`, { method: 'PATCH', prefer: 'return=representation', body: { estado: b.estado } });
      return res.json(m);
    }
    default:
      throw new ErrorPublico('Acción desconocida.', 404);
  }
});
