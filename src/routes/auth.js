const router = require('express').Router();
const bcrypt = require('bcrypt');
const { z } = require('zod');
const User = require('../models/user');
const { signToken } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/httpError');
const f = require('../lib/schemas');

const BCRYPT_COST = 12;

// Default z.object strips unknown keys, so a client-supplied `role` is silently ignored.
const registerSchema = z.object({
  name: f.name,
  email: f.email,
  password: f.password,
  interests: f.interests.default([]),
});
const loginSchema = z.object({ email: f.email, password: z.string().min(1).max(72) });

router.post('/register', asyncHandler(async (req, res) => {
  const { password, ...data } = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await User.create({ ...data, passwordHash, role: 'user' }); // dup email -> 11000 -> 409
  res.status(201).json({ token: signToken(user), user });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email }).select('+passwordHash'); // {email:1}
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new HttpError(401, 'Invalid email or password');
  res.json({ token: signToken(user), user });
}));

module.exports = router;
