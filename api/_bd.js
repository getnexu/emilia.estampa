/* Base de datos de Emilia Estampa (Upstash Redis vía la integración de Vercel). Sin dependencias. */
const crypto = require("crypto");
const URL_BD = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const CLAVE_HASH = "827b279e1d34cabbb5155a22ab1623a88f4a142327fc79ba78f8d6a9ac7a969d"; // SHA-256 de la clave por defecto. Para cambiarla, crea la variable ADMIN_CLAVE en Vercel.

function hayBD() { return !!(URL_BD && TOKEN); }

async function redis(cmd) {
  if (!hayBD()) { const e = new Error("Base de datos no conectada"); e.status = 503; throw e; }
  const r = await fetch(URL_BD, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function sha(s) { return crypto.createHash("sha256").update(String(s || ""), "utf8").digest("hex"); }
function igual(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function autorizado(req) {
  const c = String(req.headers["x-admin-clave"] || "");
  if (!c) return false;
  return process.env.ADMIN_CLAVE ? igual(sha(c), sha(process.env.ADMIN_CLAVE)) : igual(sha(c), CLAVE_HASH);
}

function responder(res, status, data) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(data)); }
function fallo(res, e) { responder(res, e.status || 500, { ok: false, error: e.message || "Error" }); }

module.exports = { redis, hayBD, autorizado, responder, fallo };
