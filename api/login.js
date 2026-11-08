const { hayBD, autorizado, responder } = require("./_bd.js");
module.exports = async (req, res) => {
  if (req.method !== "POST") return responder(res, 405, { ok: false });
  res.setHeader("Cache-Control", "no-store");
  if (!autorizado(req)) return responder(res, 401, { ok: false, error: "Contraseña incorrecta" });
  responder(res, 200, { ok: true, bd: hayBD() });
};
