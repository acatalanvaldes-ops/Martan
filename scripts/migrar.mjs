// Aplica en Supabase los scripts de supabase/migraciones/ que aún no se han ejecutado.
// Corre en cada deploy de Vercel (buildCommand), con la conexión que dejó la integración de Supabase.
// Cada script se aplica una sola vez y queda registrado en la tabla _migraciones.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const DIR = path.join(process.cwd(), 'supabase', 'migraciones');
const log = (...a) => console.log('[migraciones]', ...a);

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) {
  log('No hay POSTGRES_URL en este entorno: se omiten las migraciones.');
  process.exit(0);
}

// Supabase usa un certificado propio: se cifra la conexión sin validar la cadena (sslmode=require).
const conexion = new URL(url);
conexion.searchParams.delete('sslmode');
const cliente = new pg.Client({
  connectionString: conexion.toString(),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await cliente.connect();
} catch (e) {
  // Sin conexión no se bloquea la publicación del sitio: se reintentará en el próximo deploy.
  console.warn('[migraciones] No se pudo conectar a la base de datos:', e.message);
  process.exit(0);
}

try {
  await cliente.query(`
    create table if not exists _migraciones (
      nombre      text primary key,
      aplicada_en timestamptz not null default now()
    );
    alter table _migraciones enable row level security;
  `);
  const hechas = new Set((await cliente.query('select nombre from _migraciones')).rows.map((r) => r.nombre));
  const pendientes = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort().filter((f) => !hechas.has(f));

  if (!pendientes.length) log('Base de datos al día.');
  for (const archivo of pendientes) {
    const sql = fs.readFileSync(path.join(DIR, archivo), 'utf8');
    log(`Aplicando ${archivo}…`);
    try {
      await cliente.query('begin');
      await cliente.query(sql);
      await cliente.query('insert into _migraciones (nombre) values ($1)', [archivo]);
      await cliente.query('commit');
      log(`✓ ${archivo}`);
    } catch (e) {
      await cliente.query('rollback').catch(() => {});
      // Un error de SQL sí detiene el deploy: así nunca se publica código que depende de un cambio fallido.
      console.error(`[migraciones] ✗ ${archivo}: ${e.message}`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await cliente.end();
}
