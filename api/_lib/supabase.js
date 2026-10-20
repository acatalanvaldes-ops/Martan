// Cliente mínimo de la API REST de Supabase (PostgREST), sin dependencias.
import { ErrorPublico } from './http.js';

const BASE = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

function cabeceras() {
  if (!BASE || !CLAVE) {
    throw new ErrorPublico('La tienda aún no está configurada (faltan las variables de Supabase).', 503);
  }
  const headers = { apikey: CLAVE };
  // Las claves nuevas (sb_secret_…) van solo en "apikey"; las antiguas (JWT) también en Authorization.
  if (!CLAVE.startsWith('sb_')) headers.Authorization = `Bearer ${CLAVE}`;
  return headers;
}

export async function sb(ruta, { method = 'GET', body, prefer } = {}) {
  const headers = { ...cabeceras(), 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;

  const r = await fetch(`${BASE}/rest/v1/${ruta}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contenido = await r.text();
  if (!r.ok) {
    throw new Error(`Supabase ${r.status} en ${method} ${ruta.split('?')[0]}: ${contenido.slice(0, 300)}`);
  }
  return contenido ? JSON.parse(contenido) : null;
}

export const rpc = (fn, args) => sb(`rpc/${fn}`, { method: 'POST', body: args });

// ---------- Storage (fotos de productos) ----------
async function crearBucketPublico(id) {
  const r = await fetch(`${BASE}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...cabeceras(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id, name: id, public: true,
      file_size_limit: 5 * 1024 * 1024,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
    }),
  });
  if (!r.ok && r.status !== 409) throw new Error(`Storage ${r.status} al crear bucket: ${(await r.text()).slice(0, 300)}`);
}

// Sube un archivo a un bucket público (lo crea si no existe) y devuelve su URL pública.
export async function subirArchivo(bucket, ruta, contenido, tipo) {
  const subir = () => fetch(`${BASE}/storage/v1/object/${bucket}/${ruta}`, {
    method: 'POST',
    headers: { ...cabeceras(), 'Content-Type': tipo, 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
    body: contenido,
  });
  let r = await subir();
  if (!r.ok) {
    const t = await r.text();
    if (!/bucket not found/i.test(t)) throw new Error(`Storage ${r.status} al subir: ${t.slice(0, 300)}`);
    await crearBucketPublico(bucket);
    r = await subir();
    if (!r.ok) throw new Error(`Storage ${r.status} al subir: ${(await r.text()).slice(0, 300)}`);
  }
  return `${BASE}/storage/v1/object/public/${bucket}/${ruta}`;
}
