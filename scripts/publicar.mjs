// Arma la carpeta public/ con lo único que debe quedar visible en la web:
// las páginas .html de la raíz y la carpeta assets/. Así, archivos internos
// (supabase/*.sql, scripts/, README, package.json) nunca se publican.
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.cwd();
const destino = path.join(raiz, 'public');

fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino);

const paginas = fs.readdirSync(raiz).filter((f) => f.endsWith('.html'));
for (const f of paginas) fs.copyFileSync(path.join(raiz, f), path.join(destino, f));
fs.cpSync(path.join(raiz, 'assets'), path.join(destino, 'assets'), { recursive: true });

console.log(`[publicar] ${paginas.length} páginas + assets/ → public/`);
