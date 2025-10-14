// backend/index.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const jobsRoutes = require('./routes/jobs');
const applicationsRoutes = require('./routes/applications');

const app = express();

app.use(helmet());
app.use(express.json());

// Si sirves frontend desde este mismo servidor, no necesitas cors
// Si lo sirves por separado, configura origin y credentials
app.use(cors({
  origin: 'http://localhost:3000', // cambia si frontend en otro puerto/dominio
  credentials: true
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'cambiar_por_una_variable_segura',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false // en producción con HTTPS poner true
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/applications', applicationsRoutes);

// sirviendo frontend estático (opcional)
app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server en http://localhost:${PORT}`));
