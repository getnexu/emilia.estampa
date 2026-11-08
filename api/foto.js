const crypto = require("crypto");
const { redis, autorizado, responder, fallo } = require("./_bd.js");
module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const id = String((req.query && req.query.id) || "").replace(/[^a-z0-9]/gi, "");
      const raw = id ? await redis(["GET", "ee:foto:" + id]) : null;
      const m = raw && /^data:([^;]+);base64,(.*)$/.exec(raw);
      if (!m) { res.statusCode = 404; return res.end("Foto no encontrada"); }
      res.setHeader("Content-Type", m[1]);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.end(Buffer.from(m[2], "base64"));
    }
    if (req.method !== "POST") return responder(res, 405, { ok: false });
    if (!autorizado(req)) return responder(res, 401, { ok: false, error: "Sesión vencida. Vuelve a entrar." });
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const data = body && body.data;
    if (typeof data !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(data)) return responder(res, 400, { ok: false, error: "Formato de foto no válido" });
    if (data.length > 3500000) return responder(res, 413, { ok: false, error: "La foto es muy pesada" });
    const id = crypto.randomBytes(9).toString("hex");
    await redis(["SET", "ee:foto:" + id, data]);
    responder(res, 200, { ok: true, url: "/api/foto?id=" + id });
  } catch (e) { fallo(res, e); }
};
