// GET /api/estado → estado de la base de datos: qué migraciones de supabase/migraciones/ están aplicadas.
// No expone datos de clientes ni de productos; sirve para verificar que cada deploy dejó la base al día.
import { ruta } from './_lib/http.js';
import { sb } from './_lib/supabase.js';

export default ruta(['GET'], async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let migraciones = [];
  try {
    migraciones = (await sb('_migraciones?select=nombre,aplicada_en&order=nombre.asc'))
      .map((m) => `${m.nombre} (${m.aplicada_en.slice(0, 16).replace('T', ' ')} UTC)`);
  } catch {
    migraciones = null; // la tabla aún no existe: las migraciones automáticas no han corrido
  }
  res.status(200).json({ ok: true, migraciones });
});
