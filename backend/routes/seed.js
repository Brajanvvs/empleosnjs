// backend/routes/seed.js
const router = require('express').Router();
const bcrypt = require('bcrypt');
const pool = require('../db');

/**
 * Util: solo permitir si ENABLE_SEED === 'true'
 */
function ensureSeedEnabled(req, res) {
  if (process.env.ENABLE_SEED !== 'true') {
    res.status(403).json({ ok: false, msg: 'Seed deshabilitado en este entorno' });
    return false;
  }
  return true;
}

/**
 * GET /api/seed/admin
 * Crea admin inicial si no existe.
 *
 * .env:
 *   ENABLE_SEED=true
 *   SEED_ADMIN_EMAIL=admin@demo.com
 *   SEED_ADMIN_PASS=admin123
 *   SEED_ADMIN_NAME=Admin Global
 */
router.get('/admin', async (req, res) => {
  if (!ensureSeedEnabled(req, res)) return;
  try {
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@demo.com';
    const pass  = process.env.SEED_ADMIN_PASS  || 'admin123';
    const name  = process.env.SEED_ADMIN_NAME  || 'Admin Global';

    const [exists] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) {
      return res.json({ ok: true, msg: 'Ya existe un admin con ese correo', email });
    }

    const hash = await bcrypt.hash(pass, 10);
    await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)',
      [name, email, hash, 'ADMIN']
    );

    res.json({ ok: true, msg: 'Administrador creado exitosamente', credentials: { email, pass } });
  } catch (e) {
    console.error('SEED /admin error:', e);
    res.status(500).json({ ok: false, msg: 'Error creando admin', error: e.message });
  }
});

/**
 * POST /api/seed/reset
 * Resetea datos de desarrollo: elimina aplicaciones, empleos, empresas y usuarios NO ADMIN.
 * Requiere token de seguridad en el body o header:
 *   - Header:  X-Seed-Token: <token>
 *   - Body JSON: { "token": "<token>" }
 *
 * .env:
 *   ENABLE_SEED=true
 *   SEED_RESET_TOKEN=superseguro123
 *
 * NOTA: no borra usuarios con role = 'ADMIN'
 */
router.post('/reset', async (req, res) => {
  if (!ensureSeedEnabled(req, res)) return;

  const headerToken = req.get('X-Seed-Token');
  const bodyToken = req.body?.token;
  const token = headerToken || bodyToken;

  if (!token || token !== (process.env.SEED_RESET_TOKEN || 'dev-reset')) {
    return res.status(401).json({ ok: false, msg: 'Token inválido para reset' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Borrar aplicaciones (tiene FK a jobs/users)
    await conn.execute('DELETE FROM applications');

    // 2) Borrar jobs (tiene FK a companies)
    await conn.execute('DELETE FROM jobs');

    // 3) Borrar companies (FK a users)
    await conn.execute('DELETE FROM companies');

    // 4) Borrar users NO ADMIN
    await conn.execute("DELETE FROM users WHERE role <> 'ADMIN'");

    await conn.commit();
    res.json({ ok: true, msg: 'Reset de datos completado. Se preservaron usuarios ADMIN.' });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error('SEED /reset error:', e);
    res.status(500).json({ ok: false, msg: 'Error haciendo reset', error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
