// backend/routes/admin.js
const router = require('express').Router();
const pool = require('../db'); // mysql2/promise
const { requireRole } = require('../middleware/auth');

// Solo ADMIN en todo este router
router.use(requireRole('ADMIN'));

/**
 * GET /api/admin/metrics
 * Métricas simples para dashboard
 */
router.get('/metrics', async (_req, res) => {
  try {
    const [[{ users }]]      = await pool.query('SELECT COUNT(*) AS users FROM users');
    const [[{ companies }]]  = await pool.query('SELECT COUNT(*) AS companies FROM companies');
    const [[{ jobs }]]       = await pool.query('SELECT COUNT(*) AS jobs FROM jobs');
    const [[{ apps }]]       = await pool.query('SELECT COUNT(*) AS apps FROM applications');
    const [[{ openJobs }]]   = await pool.query('SELECT COUNT(*) AS openJobs FROM jobs'); // placeholder; si agregas "status" en jobs, filtra por abiertos

    res.json({ ok: true, metrics: { users, companies, jobs, apps, openJobs } });
  } catch (e) {
    console.error('GET /admin/metrics', e.message);
    res.status(500).json({ ok:false, msg:'Error obteniendo métricas' });
  }
});

/**
 * GET /api/admin/applications
 * Listado global de postulaciones con paginación y filtro simple por estado
 * ?status=APPLIED|ACCEPTED|REJECTED  &  limit=10  &  offset=0
 */
router.get('/applications', async (req, res) => {
  try {
    const status = (req.query.status || '').toUpperCase();
    const limit  = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const params = [];
    let where = '';
    if (['APPLIED','ACCEPTED','REJECTED','HIRED'].includes(status)) {
      where = 'WHERE a.status = ?';
      params.push(status);
    }

    const [rows] = await pool.execute(
      `SELECT a.id, a.status, a.created_at,
              u.id AS user_id, COALESCE(u.full_name, u.name) AS applicant_name, u.email AS applicant_email,
              j.id AS job_id, j.title,
              c.name AS company
         FROM applications a
         JOIN users u ON u.id = a.user_id
         JOIN jobs  j ON j.id = a.job_id
         JOIN companies c ON c.id = j.company_id
        ${where}
        ORDER BY a.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({ ok:true, applications: rows, pagination: { limit, offset, count: rows.length } });
  } catch (e) {
    console.error('GET /admin/applications', e.message);
    res.status(500).json({ ok:false, msg:'Error listando postulaciones' });
  }
});

/**
 * PATCH /api/admin/applications/:id
 * Cambiar estado de una postulación (APPLIED/ACCEPTED/REJECTED/HIRED)
 * Body: { status }
 */
router.patch('/applications/:id', async (req, res) => {
  try {
    const appId = Number(req.params.id);
    const status = String(req.body?.status || '').toUpperCase();
    const allowed = ['APPLIED','ACCEPTED','REJECTED','HIRED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ ok:false, msg:'status inválido' });
    }
    await pool.execute('UPDATE applications SET status = ? WHERE id = ?', [status, appId]);
    res.json({ ok:true, msg:'Estado actualizado' });
  } catch (e) {
    console.error('PATCH /admin/applications/:id', e.message);
    res.status(500).json({ ok:false, msg:'Error actualizando estado' });
  }
});

module.exports = router;
