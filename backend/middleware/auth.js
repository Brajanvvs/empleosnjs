// backend/middleware/auth.js

// Requiere sesión iniciada
function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ ok: false, msg: 'Debes iniciar sesión' });
  }
  next();
}

// Requiere un rol específico
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ ok: false, msg: 'Debes iniciar sesión' });
    }
    if (req.session.user.role !== role) {
      return res.status(403).json({ ok: false, msg: `Solo ${role} puede realizar esta acción` });
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };
