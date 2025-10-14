// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Faltan campos' });

  try {
    const [exists] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) return res.status(409).json({ error: 'Email ya registrado' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password) VALUES (?,?,?)',
      [name, email, hashed]
    );

    req.session.userId = result.insertId;
    res.json({ message: 'Usuario creado', userId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos' });

  try {
    const [rows] = await pool.execute('SELECT id, password, name FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });

    req.session.userId = user.id;
    res.json({ message: 'Login correcto', user: { id: user.id, name: user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Sesión cerrada' });
  });
});

module.exports = router;
