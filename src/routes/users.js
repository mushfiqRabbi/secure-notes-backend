const router = require('express').Router();
const bcrypt = require('bcrypt');
const { z } = require('zod');
const User = require('../models/user');
const Note = require('../models/note');
const Post = require('../models/post');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/objectId');
const { asyncHandler, HttpError } = require('../lib/httpError');
const { parsePage, pageResult } = require('../lib/pagination');
const f = require('../lib/schemas');
const { groupUsersByInterest } = require('../services/interestGroups');

const BCRYPT_COST = 12;
const role = z.enum(['user', 'admin']);

const createSchema = z.object({
  name: f.name,
  email: f.email,
  password: f.password,
  role: role.default('user'),
  interests: f.interests.default([]),
});
const patchSchema = z
  .object({ name: f.name, email: f.email, password: f.password, role, interests: f.interests })
  .partial();

router.use(authenticate, requireRole('admin'));

// No filter, sorted by _id -> default _id index; no dedicated index required.
router.get('/', asyncHandler(async (req, res) => {
  const pg = parsePage(req.query);
  const [items, total] = await Promise.all([
    User.find().sort({ _id: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    User.countDocuments(),
  ]);
  res.json(pageResult(items.map(strip), total, pg));
}));

// Declared before '/:id' so "by-interest" is not parsed as an id.
router.get('/by-interest', asyncHandler(async (req, res) => {
  const pg = parsePage(req.query);
  const interest = typeof req.query.interest === 'string' && req.query.interest.trim()
    ? req.query.interest.trim().toLowerCase()
    : undefined;
  const { items, total } = await groupUsersByInterest({ interest, skip: pg.skip, limit: pg.limit });
  res.json(pageResult(items, total, pg));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { password, ...data } = createSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  res.status(201).json(await User.create({ ...data, passwordHash }));
}));

router.get('/:id', validateObjectId('id'), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  res.json(user);
}));

router.patch('/:id', validateObjectId('id'), asyncHandler(async (req, res) => {
  const { password, ...rest } = patchSchema.parse(req.body);
  const update = { ...rest };
  if (password) update.passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await User.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
  if (!user) throw new HttpError(404, 'User not found');
  res.json(user);
}));

router.delete('/:id', validateObjectId('id'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) throw new HttpError(400, 'Admins cannot delete themselves');
  const result = await User.deleteOne({ _id: id });
  if (!result.deletedCount) throw new HttpError(404, 'User not found');
  // Cascade: both deletes ride on the compound-index prefixes ({owner}, {author}).
  await Promise.all([Note.deleteMany({ owner: id }), Post.deleteMany({ author: id })]);
  res.status(204).end();
}));

// .lean() skips the model's toJSON transform, so drop internal fields here.
function strip({ passwordHash, __v, ...rest }) {
  return rest;
}

module.exports = router;
