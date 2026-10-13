const { ZodError } = require('zod');
const { HttpError } = require('../lib/httpError');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.issues });
  }
  if (err.code === 11000) return res.status(409).json({ error: 'Duplicate value' });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
};

module.exports = { errorHandler };
