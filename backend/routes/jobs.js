// backend/routes/jobs.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Obtener todos los empleos
router.get('/', async (req, res) => {
  const [rows] = await pool.execute('SELECT id, title, company, description, location, created_at FROM jobs ORDER BY created_at DESC');
  res.json(rows);
});

// Crear empleo (ideal: proteger con rol admin)
router.post('/', async (req, res) => {
  const { title, company, description, location } = req.body;
  if (!title) return res.status(400).json({ error: 'Título requerido' });
  const [result] = await pool.execute(
    'INSERT INTO jobs (title, company, description, location) VALUES (?,?,?,?)',
    [title, company, description, location]
  );
  res.json({ message: 'Trabajo creado', id: result.insertId });
});

module.exports = router;
