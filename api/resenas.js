/* Reseñas de clientes.
   GET            → reseñas publicadas (público).
   POST           → una clienta deja su reseña; queda pendiente hasta que se apruebe (público, con límites).
   GET ?todas=1   → todas, incluidas las pendientes (requiere la clave del panel).
   PUT {id, accion: "publicar" | "ocultar" | "borrar"} → moderación (requiere la clave del panel). */
const crypto = require("crypto");
const { redis, autorizado, responder, fallo } = require("./_bd.js");

const KEY = "ee:resenas";
const MAX_RESENAS = 500;
const MAX_POR_HORA = 3;

/* HGETALL de Upstash llega como [campo, valor, campo, valor, ...] */
async function todas() {
  const r = await redis(["HGETALL", KEY]);
  const pares = Array.isArray(r) ? r : Object.entries(r || {}).flat();
  const lista = [];
  for (let i = 1; i < pares.length; i += 2) {
    try { lista.push(JSON.parse(pares[i])); } catch (e) { /* entrada ilegible: se omite */ }
  }
  return lista.sort((a, b) => b.fecha - a.fecha);
}
const publica = (r) => ({ id: r.id, nombre: r.nombre, estrellas: r.estrellas, texto: r.texto, producto: r.producto || "", fecha: r.fecha });
const limpiar = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const lista = await todas();
      if (req.query && req.query.todas) {
        if (!autorizado(req)) return responder(res, 401, { ok: false, error: "Sesión vencida. Vuelve a entrar." });
        return responder(res, 200, { ok: true, resenas: lista });
      }
      const pub = lista.filter(r => r.estado === "publicada").map(publica);
      const promedio = pub.length ? Math.round(pub.reduce((a, r) => a + r.estrellas, 0) / pub.length * 10) / 10 : null;
      return responder(res, 200, { ok: true, resenas: pub, promedio, total: pub.length });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    if (req.method === "POST") {
      if (body.sitio) return responder(res, 200, { ok: true }); // campo trampa: lo llenan solo los robots
      const nombre = limpiar(body.nombre, 40);
      const texto = limpiar(body.texto, 600);
      const producto = limpiar(body.producto, 80);
      const estrellas = Number(body.estrellas);
      if (nombre.length < 2) return responder(res, 400, { ok: false, error: "Escribe tu nombre." });
      if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) return responder(res, 400, { ok: false, error: "Elige una calificación de 1 a 5 estrellas." });
      if (texto.length < 10) return responder(res, 400, { ok: false, error: "Cuéntanos un poco más (al menos 10 caracteres)." });

      const ip = String(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "").split(",")[0].trim();
      const k = "ee:resenas:ip:" + crypto.createHash("sha256").update(ip).digest("hex").slice(0, 24);
      const n = await redis(["INCR", k]);
      if (n === 1) await redis(["EXPIRE", k, 3600]);
      if (n > MAX_POR_HORA) return responder(res, 429, { ok: false, error: "Ya recibimos tus reseñas. Intenta más tarde." });
      if ((await redis(["HLEN", KEY])) >= MAX_RESENAS) return responder(res, 503, { ok: false, error: "No pudimos guardar tu reseña. Escríbenos por WhatsApp." });

      const r = { id: crypto.randomBytes(6).toString("hex"), nombre, estrellas, texto, producto, fecha: Date.now(), estado: "pendiente" };
      await redis(["HSET", KEY, r.id, JSON.stringify(r)]);
      return responder(res, 200, { ok: true });
    }

    if (req.method === "PUT") {
      if (!autorizado(req)) return responder(res, 401, { ok: false, error: "Sesión vencida. Vuelve a entrar." });
      const id = String(body.id || "").replace(/[^a-f0-9]/g, "");
      const raw = id ? await redis(["HGET", KEY, id]) : null;
      if (!raw) return responder(res, 404, { ok: false, error: "Reseña no encontrada." });
      if (body.accion === "borrar") {
        await redis(["HDEL", KEY, id]);
        return responder(res, 200, { ok: true });
      }
      if (body.accion !== "publicar" && body.accion !== "ocultar") return responder(res, 400, { ok: false, error: "Acción no válida." });
      const r = JSON.parse(raw);
      r.estado = body.accion === "publicar" ? "publicada" : "pendiente";
      await redis(["HSET", KEY, id, JSON.stringify(r)]);
      return responder(res, 200, { ok: true });
    }

    responder(res, 405, { ok: false });
  } catch (e) {
    fallo(res, e);
  }
};
