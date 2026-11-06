// Baja el código fuente del último deploy de producción de web-emilia-estampa
// a esta carpeta, verificando cada archivo contra su SHA-1.
// Uso: npx vercel login   (una vez)
//      node descargar-de-vercel.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const DEPLOY = process.argv[2] || 'dpl_8R63kme3bxwGrGNSZBgYAfsiS2XM';
const TEAM = 'team_KebtvuE71GpNmO5XSSMn2KGe';

function token() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  const rutas = [
    path.join(os.homedir(), '.local/share/com.vercel.cli/auth.json'),
    path.join(os.homedir(), 'Library/Application Support/com.vercel.cli/auth.json'),
    path.join(process.env.APPDATA || '', 'com.vercel.cli/Data/auth.json'),
  ];
  for (const r of rutas) {
    try { return JSON.parse(fs.readFileSync(r, 'utf8')).token; } catch {}
  }
  console.error('No encontré la sesión de Vercel. Corre primero: npx vercel login');
  process.exit(1);
}
const TOKEN = token();

async function api(url) {
  const r = await fetch('https://api.vercel.com' + url + (url.includes('?') ? '&' : '?') + 'teamId=' + TEAM,
    { headers: { Authorization: 'Bearer ' + TOKEN } });
  if (!r.ok) throw new Error(url + ' → HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r;
}

const arbol = await (await api(`/v6/deployments/${DEPLOY}/files`)).json();
const src = arbol.find(n => n.name === 'src');
if (!src) throw new Error('El deploy no tiene carpeta src');

let n = 0;
async function bajar(nodos, rel) {
  for (const nodo of nodos) {
    const destino = path.join(rel, nodo.name);
    if (nodo.type === 'directory') { await bajar(nodo.children || [], destino); continue; }
    if (nodo.type !== 'file') continue;
    const r = await api(`/v7/deployments/${DEPLOY}/files/${nodo.uid}`);
    let buf = Buffer.from(await r.arrayBuffer());
    if ((r.headers.get('content-type') || '').includes('json')) {
      try { const j = JSON.parse(buf.toString('utf8')); if (typeof j.data === 'string') buf = Buffer.from(j.data, 'base64'); } catch {}
    }
    const sha = crypto.createHash('sha1').update(buf).digest('hex');
    if (sha !== nodo.uid) throw new Error(`${destino}: el contenido no coincide (sha1 ${sha} ≠ ${nodo.uid})`);
    fs.mkdirSync(path.dirname(destino) || '.', { recursive: true });
    fs.writeFileSync(destino, buf);
    console.log('✓', destino, (buf.length / 1024).toFixed(0) + ' KB');
    n++;
  }
}
await bajar(src.children || [], '.');
console.log(`\nListo: ${n} archivos. Ahora: git add . && git commit -m "Sitio Emilia Estampa" && git push`);
