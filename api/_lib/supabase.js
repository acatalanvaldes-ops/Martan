// Cliente mínimo de la API REST de Supabase (PostgREST), sin dependencias.
import { ErrorPublico } from './http.js';

const BASE = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

export async function sb(ruta, { method = 'GET', body, prefer } = {}) {
  if (!BASE || !CLAVE) {
    throw new ErrorPublico('La tienda aún no está configurada (faltan las variables de Supabase).', 503);
  }
  const headers = { apikey: CLAVE, 'Content-Type': 'application/json' };
  // Las claves nuevas (sb_secret_…) van solo en "apikey"; las antiguas (JWT) también en Authorization.
  if (!CLAVE.startsWith('sb_')) headers.Authorization = `Bearer ${CLAVE}`;
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
