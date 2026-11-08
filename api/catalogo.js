const { redis, autorizado, responder, fallo } = require("./_bd.js");
const KEY = "ee:catalogo";
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const raw = await redis(["GET", KEY]);
      const d = raw ? JSON.parse(raw) : null;
      return responder(res, 200, { ok: true, productos: d ? d.productos : null, fecha: d ? d.fecha : null });
    }
    if (!autorizado(req)) return responder(res, 401, { ok: false, error: "Sesión vencida. Vuelve a entrar." });
    if (req.method === "PUT" || req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.productos)) return responder(res, 400, { ok: false, error: "Datos inválidos" });
      const d = { productos: body.productos, fecha: Date.now() };
      const prev = await redis(["GET", KEY]);
      if (prev) await redis(["SET", "ee:catalogo:respaldo", prev]);
      await redis(["SET", KEY, JSON.stringify(d)]);
      return responder(res, 200, { ok: true, fecha: d.fecha });
    }
    if (req.method === "DELETE") { await redis(["DEL", KEY]); return responder(res, 200, { ok: true }); }
    responder(res, 405, { ok: false });
  } catch (e) { fallo(res, e); }
};
