// Importar dependencias
const express = require('express');
const cors = require('cors');
const pool = require('./db'); // Este es el archivo db.js que ya hiciste

// Crear la aplicación Express
const app = express();
app.use(cors());
app.use(express.json());
const path = require('path');

// Log simple de peticiones para depuración mínima
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

// Servir archivos estáticos del frontend

// Ruta principal de prueba
app.get('/', (req, res) => {
  res.send('Servidor funcionando 🚀');
});

// ✅ Ruta para obtener los empleos
app.get('/api/jobs', (req, res) => {
  pool.query('SELECT id, title, company, location, description, image_url FROM jobs', (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      res.status(500).json({ error: 'Error al obtener los empleos' });
    } else {
      res.json(results);
    }
  });
});

// ✅ Nueva ruta para postularse a un empleo
app.post('/api/apply', (req, res) => {
  const { user_id, job_id } = req.body;
  if (!user_id || !job_id) return res.status(400).json({ error: 'user_id y job_id son requeridos' });

  // Verificar que el usuario existe
  pool.query('SELECT id FROM users WHERE id = ?', [user_id], (err, rows) => {
    if (err) {
      console.error('Error SQL al verificar usuario:', err);
      return res.status(500).json({ error: 'Error al verificar usuario' });
    }
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Insertar postulación
    pool.query(
      'INSERT INTO applications (user_id, job_id) VALUES (?, ?)',
      [user_id, job_id],
      (err2, result) => {
        if (err2) {
          console.error('Error al postularse:', err2);
          // devolver detalles para depuración (temporal)
          return res.status(500).json({ error: 'Error al postularse', details: err2.message });
        }
        res.json({ message: 'Postulación enviada con éxito ✅' });
      }
    );
  });
});

// Obtener postulaciones de un usuario (incluye datos del trabajo)
app.get('/api/applications', (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id es requerido' });

  const sql = `SELECT a.id as application_id, a.user_id, a.job_id, a.created_at, j.title, j.company, j.location, j.description
               FROM applications a
               JOIN jobs j ON a.job_id = j.id
               WHERE a.user_id = ?
               ORDER BY a.created_at DESC`;
  pool.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('Error al obtener postulaciones:', err);
      return res.status(500).json({ error: 'Error al obtener postulaciones' });
    }
    res.json(results);
  });
});

// Eliminar una postulación por id (verifica owner mediante query user_id)
app.delete('/api/applications/:id', (req, res) => {
  const appId = req.params.id;
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id es requerido' });

  pool.query('SELECT user_id FROM applications WHERE id = ?', [appId], (err, rows) => {
    if (err) {
      console.error('Error SQL al comprobar aplicación:', err);
      return res.status(500).json({ error: 'Error al comprobar aplicación' });
    }
    if (rows.length === 0) return res.status(404).json({ error: 'Postulación no encontrada' });
    if (String(rows[0].user_id) !== String(userId)) return res.status(403).json({ error: 'No autorizado' });

    pool.query('DELETE FROM applications WHERE id = ?', [appId], (err2, result) => {
      if (err2) {
        console.error('Error al eliminar postulación:', err2);
        return res.status(500).json({ error: 'Error al eliminar postulación' });
      }
      res.json({ message: 'Postulación eliminada' });
    });
  });
});

// ✅ Rutas adicionales (usuarios, login, etc.)
// Respuesta directa para GET a /api/users/register (evita "Cannot GET ..." si se visita desde el navegador)
app.get('/api/users/register', (req, res) => {
  res.json({ message: 'GET recibido. Para registrar usuarios, envía un POST con {name,email,password} a esta URL.' });
});

const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);
// Ruta pública para ver el formulario de registro en el navegador
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'register.html'));
});

// Ruta de diagnóstico simple
app.get('/test-register', (req, res) => {
  res.send('TEST REGISTER OK');
});

// Servir archivos estáticos del frontend (colocado al final para no interceptar rutas /api)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Iniciar el servidor
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// DEBUG: listar rutas (solo desarrollo)
app.get('/debug/routes', (req, res) => {
  try {
    const routes = [];
    app._router.stack.forEach(mw => {
      if (mw.route && mw.route.path) routes.push(mw.route.path);
      else if (mw.name === 'router' && mw.handle && mw.handle.stack) {
        mw.handle.stack.forEach(h => { if (h.route && h.route.path) routes.push(h.route.path); });
      }
    });
    res.json(routes);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/debug/info', (req, res) => {
  res.json({ cwd: process.cwd(), filename: __filename });
});
