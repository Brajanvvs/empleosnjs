// backend/db.js
require('dotenv').config();
const mysql = require('mysql2/promise'); // << promesas

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'portal_empleos_v2',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log('🟢 Conectado a MySQL. DB =', process.env.DB_NAME);
module.exports = pool;
