// backend/routes/applications.js
const router = require('express').Router();
const pool = require('../db'); // mysql2/promise
const { requireRole } = require('../middleware/auth');

/**
 * POST /api/applications
 * Body: { job_id }
 * Solo USER puede postularse.
 * UNIQUE(job_id, user_id) evita duplicados.
 */
router.post('/', requireRole('USER'), async (req, res) => {
  try {
    const { job_id } = req.body || {};
    if (!job_id) return res.status(400).json({ ok: false, msg: 'job_id es obligatorio' });

    const userId = req.session.user.id;

    // valida que el empleo exista
    const [jobRows] = await pool.execute('SELECT id FROM jobs WHERE id = ? LIMIT 1', [job_id]);
    if (!jobRows.length) return res.status(404).json({ ok: false, msg: 'Empleo no encontrado' });

    await pool.execute(
      'INSERT INTO applications (job_id, user_id) VALUES (?, ?)',
      [job_id, userId]
    );

    res.status(201).json({ ok: true, msg: 'Postulación creada' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, msg: 'Ya te postulaste a este empleo' });
    }
    console.error('POST /api/applications error:', err.code, err.sqlMessage || err.message);
    res.status(500).json({ ok: false, msg: 'Error al postularse' });
  }
});

/**
 * GET /api/applications/mine
 * Mis postulaciones (USER)
 */
router.get('/mine', requireRole('USER'), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await pool.execute(
      `SELECT a.id               AS application_id,
              a.status,
              a.created_at,
              j.id               AS job_id,
              j.title,
              j.description,
              j.salary,
              c.name             AS company,
              c.location         AS location
         FROM applications a
         JOIN jobs j      ON j.id = a.job_id
         JOIN companies c ON c.id = j.company_id
        WHERE a.user_id = ?
        ORDER BY a.created_at DESC`,
      [userId]
    );
    res.json({ ok: true, applications: rows });
  } catch (err) {
    console.error('GET /api/applications/mine error:', err.message);
    res.status(500).json({ ok: false, msg: 'Error listando postulaciones' });
  }
});

/**
 * GET /api/applications/by-job/:jobId
 * EMPLOYER ve candidatos de un empleo propio
 */
router.get('/by-job/:jobId', requireRole('EMPLOYER'), async (req, res) => {
  try {
    const jobId = Number(req.params.jobId);
    const employerId = req.session.user.id;

    // asegurar que el empleo me pertenece
    const [own] = await pool.execute(
      `SELECT j.id
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
        WHERE j.id = ? AND c.user_id = ?
        LIMIT 1`,
      [jobId, employerId]
    );
    if (!own.length) {
      return res.status(403).json({ ok: false, msg: 'No puedes ver postulaciones de este empleo' });
    }

    const [rows] = await pool.execute(
      `SELECT a.id          AS application_id,
              a.status,
              a.created_at,
              u.id          AS applicant_id,
              u.name        AS applicant_name,
              u.email       AS applicant_email
         FROM applications a
         JOIN users u ON u.id = a.user_id
        WHERE a.job_id = ?
        ORDER BY a.created_at DESC`,
      [jobId]
    );

    res.json({ ok: true, applications: rows });
  } catch (err) {
    console.error('GET /api/applications/by-job error:', err.message);
    res.status(500).json({ ok: false, msg: 'Error listando postulaciones del empleo' });
  }
});

/**
 * PATCH /api/applications/:id
 * Cambiar estado de postulación (EMPLOYER dueño del job)
 * Body: { status: 'APPLIED'|'REVIEWING'|'HIRED'|'REJECTED' }
 */
router.patch('/:id', requireRole('EMPLOYER'), async (req, res) => {
  try {
    const appId = Number(req.params.id);
    const { status } = req.body || {};
    const employerId = req.session.user.id;

    const allowed = ['APPLIED', 'REVIEWING', 'HIRED', 'REJECTED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, msg: 'status inválido' });
    }

    // comprobar ownership (que la app pertenece a un job de su empresa)
    const [rows] = await pool.execute(
      `SELECT a.id
         FROM applications a
         JOIN jobs j      ON j.id = a.job_id
         JOIN companies c ON c.id = j.company_id
        WHERE a.id = ? AND c.user_id = ?
        LIMIT 1`,
      [appId, employerId]
    );
    if (!rows.length) return res.status(403).json({ ok: false, msg: 'No autorizado' });

    await pool.execute('UPDATE applications SET status = ? WHERE id = ?', [status, appId]);
    res.json({ ok: true, msg: 'Estado actualizado' });
  } catch (err) {
    console.error('PATCH /api/applications/:id error:', err.message);
    res.status(500).json({ ok: false, msg: 'Error actualizando estado' });
  }
});

/**
 * DELETE /api/applications/:id
 * USER cancela su propia postulación
 */
router.delete('/:id', requireRole('USER'), async (req, res) => {
  try {
    const appId = Number(req.params.id);
    const userId = req.session.user.id;

    // owner check
    const [rows] = await pool.execute(
      'SELECT user_id FROM applications WHERE id = ? LIMIT 1',
      [appId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, msg: 'Postulación no encontrada' });
    if (rows[0].user_id !== userId) return res.status(403).json({ ok: false, msg: 'No autorizado' });

    await pool.execute('DELETE FROM applications WHERE id = ?', [appId]);
    res.json({ ok: true, msg: 'Postulación eliminada' });
  } catch (err) {
    console.error('DELETE /api/applications/:id error:', err.message);
    res.status(500).json({ ok: false, msg: 'Error al eliminar postulación' });
  }
});

module.exports = router;
