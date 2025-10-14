// backend/routes/applications.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// middleware simple para verificar sesión
function ensureAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'No autorizado' });
}

// Aplicar a un trabajo
router.post('/jobs/:jobId/apply', ensureAuth, async (req, res) => {
  const userId = req.session.userId;
  const jobId = req.params.jobId;
  const { cover_letter } = req.body;

  try {
    await pool.execute(
      'INSERT INTO applications (user_id, job_id, cover_letter) VALUES (?,?,?)',
      [userId, jobId, cover_letter || null]
    );
    res.json({ message: 'Postulación enviada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al postular' });
  }
});

module.exports = router;
