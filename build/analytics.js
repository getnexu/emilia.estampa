/* Vercel Web Analytics: se agrega justo antes de </head> en cada página ya generada en public/. */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public');
const ANALYTICS = '<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>\n<script defer src="/_vercel/insights/script.js"></script>\n';

const paginas = fs.readdirSync(OUT).filter(f => f.endsWith('.html'));
for (const rel of paginas) {
  const f = path.join(OUT, rel), html = fs.readFileSync(f, 'utf8');
  if (html.split('</head>').length !== 2) { console.error(rel + ': no tiene un único </head>.'); process.exit(1); }
  fs.writeFileSync(f, html.replace('</head>', () => ANALYTICS + '</head>'));
}
console.log('Web Analytics en:', paginas.join(', '));
