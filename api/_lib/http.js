// Utilidades HTTP compartidas por las funciones de api/.
// Los archivos dentro de carpetas que empiezan con "_" no se publican como endpoints.

export class ErrorPublico extends Error {
  constructor(mensaje, status = 400, extra = {}) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}

// Envuelve un handler: valida el método y transforma errores en respuestas JSON.
export function ruta(metodos, fn) {
  return async (req, res) => {
    if (!metodos.includes(req.method)) {
      res.setHeader('Allow', metodos.join(', '));
      return res.status(405).json({ error: 'Método no permitido' });
    }
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof ErrorPublico) {
        return res.status(e.status).json({ error: e.message, ...e.extra });
      }
      console.error(e);
      return res.status(500).json({ error: 'Ocurrió un error inesperado. Intenta nuevamente.' });
    }
  };
}

export function urlBase(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function texto(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function clp(n) {
  return '$' + Math.round(n).toLocaleString('es-CL');
}
