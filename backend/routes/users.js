const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ✅ Registrar usuario
// Respuesta informativa para peticiones GET (evita el mensaje "Cannot GET /api/users/register" si alguien visita la URL en el navegador)
router.get('/register', (req, res) => {
  res.json({ message: 'Este endpoint acepta POST con {name, email, password}. Usa el formulario o una petición POST.' });
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validar datos
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Formato de correo inválido' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Verificar email duplicado
    pool.query('SELECT id FROM users WHERE email = ?', [email], async (err, rows) => {
      if (err) {
        console.error('Error SQL al verificar email:', err);
        return res.status(500).json({ error: 'Error al verificar email' });
      }
      if (rows.length > 0) return res.status(409).json({ error: 'El correo ya está registrado' });

      // Encriptar contraseña
      const hashed = await bcrypt.hash(password, 10);
      // Insertar en BD
      pool.query(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name, email, hashed],
        (err2, results2) => {
          if (err2) {
            console.error('❌ Error SQL al insertar usuario:', err2);
            return res.status(500).json({ error: 'Error al registrar usuario' });
          }
          res.json({ message: 'Usuario registrado correctamente ✅', userId: results2.insertId, name, email });
        }
      );
    });
  } catch (error) {
    console.error('❌ Error en el servidor:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ Login (autenticación básica)
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  pool.query('SELECT id, name, password FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al iniciar sesión' });
    if (results.length === 0) return res.status(400).json({ error: 'Usuario no encontrado' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Contraseña incorrecta' });

    // Devolver solo campos necesarios (no la contraseña)
    res.json({ message: 'Inicio de sesión exitoso ✅', user: { id: user.id, name: user.name } });
  });
});

module.exports = router;
