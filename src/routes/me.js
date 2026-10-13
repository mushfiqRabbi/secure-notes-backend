const router = require('express').Router();
const bcrypt = require('bcrypt');
const { z } = require('zod');
const User = require('../models/user');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../lib/httpError');
const f = require('../lib/schemas');

// Only these fields are self-editable; role is intentionally absent.
const patchSchema = z
  .object({ name: f.name, interests: f.interests, password: f.password })
  .partial();

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  res.json(await User.findById(req.user.id)); // _id index
}));

router.patch('/', asyncHandler(async (req, res) => {
  const { password, ...rest } = patchSchema.parse(req.body);
  const update = { ...rest };
  if (password) update.passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findByIdAndUpdate(req.user.id, update, { returnDocument: 'after' });
  res.json(user);
}));

module.exports = router;
