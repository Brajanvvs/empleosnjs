// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const pool = require('../db');        // mysql2/promise
const bcrypt = require('bcrypt');

/* ======================
 * Registro de USUARIO (ROLE: USER)
 * ====================== */
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos' });
  }

  try {
    const [exists] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (exists.length) return res.status(409).json({ error: 'Email ya registrado' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "USER")',
      [name, email, hashed]
    );

    req.session.user = { id: result.insertId, name, role: 'USER' };
    res.json({ message: 'Usuario registrado', userId: result.insertId, role: 'USER' });
  } catch (err) {
    console.error('register USER error:', err);
    res.status(500).json({ error: 'Error registrando usuario' });
  }
});

/* ======================
 * Login (USER o EMPLOYER)
 * ====================== */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos' });

  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, password, role FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'Credenciales inválidas' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    req.session.user = { id: user.id, name: user.name, role: user.role };
    res.json({ message: 'Login correcto', user: req.session.user });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

/* =============
 * Logout
 * ============= */
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Sesión cerrada' });
  });
});

/* ==========================================
 * Registrar EMPRESA (ROLE: EMPLOYER) + company
 * ========================================== */
router.post('/register-company', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { email, password, name, company } = req.body || {};
    if (!email || !password || !company?.name) {
      return res.status(400).json({ error: 'email, password y company.name son obligatorios' });
    }

    const [exists] = await conn.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (exists.length) return res.status(409).json({ error: 'Email ya registrado' });

    await conn.beginTransaction();

    const hashed = await bcrypt.hash(password, 10);

    // 1) crear USER con rol EMPLOYER
    const [uRes] = await conn.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?,?,?, "EMPLOYER")',
      [name || null, email, hashed]
    );
    const userId = uRes.insertId;

    // 2) crear COMPANY 1:1
    const { name: companyName, nit, website, location } = company;
    await conn.execute(
      'INSERT INTO companies (user_id, name, nit, website, location) VALUES (?,?,?,?,?)',
      [userId, companyName, nit || null, website || null, location || null]
    );

    await conn.commit();

    req.session.user = { id: userId, name: name || companyName, role: 'EMPLOYER' };
    res.status(201).json({ message: 'Empresa registrada', userId, role: 'EMPLOYER' });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('register-company error:', err.code, err.sqlMessage || err.message);
    res.status(500).json({ error: 'Error registrando empresa' });
  } finally {
    conn.release();
  }
});

/* ======================
 * Quién está logueado (debug)
 * ====================== */
router.get('/me', (req, res) => {
  res.json({ user: req.session?.user || null });
});

module.exports = router;
