const express = require('express');
const cors = require('cors');
const config = require('./config');
const { validateObjectId } = require('./middleware/objectId');
const { errorHandler } = require('./middleware/error');
const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const notesRoutes = require('./routes/notes');

function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  if (process.env.NODE_ENV === 'test') {
    app.get('/__oid/:id', validateObjectId('id'), (_req, res) => res.json({ ok: true }));
    app.post('/__oid/:id', (_req, res) => res.json({ ok: true }));
  }

  app.use('/auth', authRoutes);
  app.use('/me', meRoutes);
  app.use('/notes', notesRoutes);
  app.use('/admin/notes', notesRoutes.adminRouter);

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
