/* EMILIA ESTAMPA — web liviana + Instagram.
   index.html llega como un paquete de Claude Design de 18 MB: todo (fotos, fuentes, React, Babel)
   va incrustado como texto y el navegador lo desempaca y compila al abrir. Este script lo convierte
   en un sitio normal:
     · cada recurso del paquete pasa a ser un archivo propio en /a/ (las fuentes se bajan solo si se usan);
     · las fotos incrustadas se sacan a /img/ y se cargan solo cuando se muestran;
     · React de desarrollo se cambia por la versión de producción (misma versión);
     · el código JSX se compila aquí, así que el navegador ya no descarga Babel (3 MB);
     · se aplican los cambios de diseño de build/patches.json y el pie de página con Instagram. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const Babel = require('@babel/standalone');

const RAIZ = path.join(__dirname, '..');
const OUT = path.join(RAIZ, 'public');
const INDEX_ORIGINAL = '8143df59baae413eedaf68d429478786e3cf7ef3';
const REVISION = process.env.VERCEL_ENV !== 'production';
const sha1 = b => crypto.createHash('sha1').update(b).digest('hex');
const EXT = { 'text/javascript': 'js', 'application/javascript': 'js', 'font/woff2': 'woff2', 'text/css': 'css', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

function escribir(rel, buf) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, buf);
}
function aplicar(texto, pares, donde) {
  for (const [antes, despues] of pares) {
    if (texto.split(antes).length !== 2) throw new Error(donde + ': cambio no aplicable: ' + antes.slice(0, 80));
    texto = texto.replace(antes, () => despues);
  }
  return texto;
}
/* Igual que Babel en el navegador para <script type="text/babel"> (presets react + env). */
const compilar = (codigo, nombre) => Babel.transform(codigo, {
  filename: nombre, presets: ['react', 'env'],
  plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
}).code;

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'));
  if (sha1(html) !== INDEX_ORIGINAL) throw new Error('index.html no es la versión esperada.');
  const s = html.toString('utf8');
  const bloque = t => {
    const a = '<script type="__bundler/' + t + '">', i = s.indexOf(a);
    if (i < 0 || s.indexOf(a, i + 1) >= 0) throw new Error('Bloque ' + t + ' no encontrado una sola vez.');
    return s.slice(i + a.length, s.indexOf('</script>', i));
  };
  const manifest = JSON.parse(bloque('manifest'));
  let tpl = aplicar(JSON.parse(bloque('template')), [...require('./patches.json'), ...require('./patches-2.json'), ...require('./patches-3.json'), ...require('./patches-4.json'), ...require('./patches-5.json')], 'diseño');

  /* Fotos incrustadas → archivos en /img/ (nombre de la foto original si se conoce). */
  const fotos = new Map();
  const nombreFoto = (tipo, b64, clave) => {
    const buf = Buffer.from(b64, 'base64'), h = sha1(buf).slice(0, 10);
    if (fotos.has(h)) return fotos.get(h);
    const ext = tipo === 'jpeg' ? 'jpg' : tipo.replace('+xml', '');
    const base = clave ? path.basename(clave).replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9-]/gi, '-') : 'foto';
    const url = '/img/' + base + '-' + h + '.' + ext;
    escribir(url.slice(1), buf);
    fotos.set(h, url);
    return url;
  };
  const sacarFotos = (texto) => texto
    .replace(/"([^"]{1,200})":"data:image\/([a-z+]+);base64,([A-Za-z0-9+\/=]+)"/g, (m, k, t, b) => '"' + k + '":"' + nombreFoto(t, b, k) + '"')
    .replace(/data:image\/([a-z+]+);base64,([A-Za-z0-9+\/=]{200,})/g, (m, t, b) => nombreFoto(t, b, null));

  /* Sistema de diseño: Instagram en el pie de página y en el menú. */
  const PIE = [[
    '}, whatsapp)), /*#__PURE__*/React.createElement("li", null, "Solo por WhatsApp. La web no procesa pagos."))',
    '}, whatsapp)), /*#__PURE__*/React.createElement("li", { style: { display: "flex", gap: 8, alignItems: "center" } }, ' +
    '/*#__PURE__*/React.createElement("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, ' +
    'React.createElement("rect", { x: 2, y: 2, width: 20, height: 20, rx: 5 }), React.createElement("path", { d: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" }), React.createElement("line", { x1: 17.5, y1: 6.5, x2: 17.51, y2: 6.5 })), ' +
    '" ", /*#__PURE__*/React.createElement("a", { href: "https://www.instagram.com/emilia.estampa/", target: "_blank", rel: "noopener" }, "@emilia.estampa")), ' +
    '/*#__PURE__*/React.createElement("li", null, "Solo por WhatsApp. La web no procesa pagos."))',
  ], [
    /* El ícono de Instagram del menú (computador) existía pero no llevaba a ninguna parte. */
    '}, l)), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {\n    icon: "instagram",\n    label: "Instagram",\n    variant: "bare"\n  }), cta &&',
    '}, l)), /*#__PURE__*/React.createElement("a", { className: "ee-iconbtn ee-iconbtn--bare", href: "https://www.instagram.com/emilia.estampa/", target: "_blank", rel: "noopener", "aria-label": "Instagram de Emilia Estampa", title: "Instagram" }, ' +
    '/*#__PURE__*/React.createElement(__ds_scope.Icon, { name: "instagram", size: 18 })), cta &&',
  ]];

  let antes = 0, despues = 0, babelUuid = null, piePuesto = false;
  const rutas = {};
  for (const [uuid, e] of Object.entries(manifest)) {
    let buf = Buffer.from(e.data, 'base64');
    if (e.compressed) buf = zlib.gunzipSync(buf);
    antes += buf.length;
    const ext = EXT[e.mime] || 'bin';
    if (ext === 'js') {
      let t = buf.toString('utf8');
      const react = /^\/\*\*[\s\S]{0,200}@license React\s*\*\s*(react|react-dom)\.development\.js/.exec(t);
      const version = (/ReactVersion = '([0-9.]+)'/.exec(t) || [])[1];
      if (react && version) {
        const url = 'https://unpkg.com/' + react[1] + '@' + version + '/umd/' + react[1] + '.production.min.js';
        const r = await fetch(url);
        if (!r.ok) throw new Error('No se pudo bajar ' + url);
        t = await r.text();
        console.log('React de producción:', react[1], version);
      } else if (t.length > 2000000 && t.includes('transformScriptTags')) {
        babelUuid = uuid;
        continue; // ya no se necesita: el JSX se compila aquí
      }
      if (t.includes('data:image/')) t = sacarFotos(t);
      if (t.includes('"Solo por WhatsApp. La web no procesa pagos."') && t.includes('function Footer')) { t = aplicar(t, PIE, 'pie'); piePuesto = true; }
      buf = Buffer.from(t, 'utf8');
    }
    const rel = 'a/' + uuid.slice(0, 8) + '-' + sha1(buf).slice(0, 10) + '.' + ext; // huella del contenido: caché larga sin versiones viejas
    rutas[uuid] = '/' + rel;
    escribir(rel, buf);
    despues += buf.length;
  }
  if (!babelUuid) throw new Error('No se identificó Babel en el paquete.');
  if (!piePuesto) throw new Error('No se pudo agregar Instagram al pie de página.');

  /* Diseño: quitar Babel, apuntar a los archivos nuevos, sin integrity (los archivos cambian). */
  tpl = tpl.replace(new RegExp('<script src="' + babelUuid + '"[^>]*></script>\\n?'), '');
  if (tpl.includes(babelUuid)) throw new Error('Babel sigue referenciado.');
  for (const [uuid, ruta] of Object.entries(rutas)) tpl = tpl.split(uuid).join(ruta);
  tpl = tpl.replace(/\s+integrity="[^"]*"/g, '').replace(/\s+crossorigin="[^"]*"/g, '');
  tpl = sacarFotos(tpl);

  /* JSX compilado aquí: <script type="text/babel"> pasa a ser un script normal. */
  let n = 0;
  tpl = tpl.replace(/<script type="text\/babel" src="(\/a\/[^"]+\.js)"><\/script>/g, (m, ruta) => {
    const f = path.join(OUT, ruta.slice(1));
    fs.writeFileSync(f, compilar(fs.readFileSync(f, 'utf8'), ruta));
    n++;
    return '<script src="' + ruta + '"></script>';
  });
  tpl = tpl.replace(/<script type="text\/babel">([\s\S]*?)<\/script>/g, (m, codigo) => { n++; return '<script>' + compilar(codigo, 'tienda.jsx') + '</script>'; });
  if (/text\/babel/.test(tpl)) throw new Error('Quedó JSX sin compilar.');

  escribir('index.html', tpl);
  despues += Buffer.byteLength(tpl);
  const logo = [...fotos.values()].find(u => u.startsWith('/img/logo-emilia-estampa-'));
  if (logo) fs.copyFileSync(path.join(OUT, logo.slice(1)), path.join(OUT, 'logo-emilia-estampa.png'));
  for (const rel of ['panel.html', 'ig.html', 'resenas-admin.html']) if (fs.existsSync(path.join(RAIZ, rel))) escribir(rel, fs.readFileSync(path.join(RAIZ, rel)));
  if (REVISION) escribir('_revision/resumen.txt', JSON.stringify({ fotos: fotos.size, scriptsCompilados: n, rutas }, null, 1));

  const mb = b => (b / 1048576).toFixed(1) + ' MB';
  const html2 = Buffer.byteLength(tpl);
  console.log('Fotos separadas:', fotos.size, '· JSX compilado:', n, '· página inicial:', (html2 / 1024).toFixed(0) + ' KB');
  console.log('Recursos del paquete:', mb(antes), '→', mb(despues), '(sin contar fotos, que se bajan solo al mostrarse)');
})().catch(e => { console.error(e.message); process.exit(1); });
