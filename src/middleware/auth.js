const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/user');
const { HttpError, asyncHandler } = require('../lib/httpError');

const signToken = (user) =>
  jwt.sign({ sub: String(user._id) }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn,
  });

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Missing token');
  let payload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new HttpError(401, 'Invalid token');
  }
  // Lookup by _id (default index); role is always read fresh so demotions apply immediately.
  const user = await User.findById(payload.sub).select('role').lean();
  if (!user) throw new HttpError(401, 'User no longer exists');
  req.user = { id: String(user._id), role: user.role };
  next();
});

const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Forbidden'));

module.exports = { signToken, authenticate, requireRole };
