const router = require('express').Router();
const adminRouter = require('express').Router();
const mongoose = require('mongoose');
const { z } = require('zod');
const Note = require('../models/note');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/objectId');
const { asyncHandler, HttpError } = require('../lib/httpError');
const { parsePage, pageResult } = require('../lib/pagination');

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(10000).default(''),
});
// Partial of the same shape; `owner` is not part of it, so it can never be reassigned.
const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().max(10000).optional(),
});

router.use(authenticate);

router.post('/', asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);
  res.status(201).json(await Note.create({ ...data, owner: req.user.id }));
}));

// Own notes: find({owner}).sort({_id:-1}) -> {owner:1,_id:-1}
router.get('/', asyncHandler(async (req, res) => {
  const pg = parsePage(req.query);
  const filter = { owner: req.user.id };
  const [items, total] = await Promise.all([
    Note.find(filter).sort({ _id: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    Note.countDocuments(filter),
  ]);
  res.json(pageResult(items, total, pg));
}));

// By id -> _id index. 404 (not 403) for other users' notes so existence is not leaked.
router.get('/:id', validateObjectId('id'), asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id).lean();
  const allowed = note && (req.user.role === 'admin' || String(note.owner) === req.user.id);
  if (!allowed) throw new HttpError(404, 'Note not found');
  res.json(note);
}));

router.patch('/:id', validateObjectId('id'), asyncHandler(async (req, res) => {
  const data = patchSchema.parse(req.body);
  const note = await Note.findOneAndUpdate({ _id: req.params.id, owner: req.user.id }, data, { returnDocument: 'after' });
  if (!note) throw new HttpError(404, 'Note not found');
  res.json(note);
}));

router.delete('/:id', validateObjectId('id'), asyncHandler(async (req, res) => {
  const result = await Note.deleteOne({ _id: req.params.id, owner: req.user.id });
  if (!result.deletedCount) throw new HttpError(404, 'Note not found');
  res.status(204).end();
}));

// Admin: everyone's notes. No filter -> default _id index; ?owner= -> {owner:1,_id:-1}.
adminRouter.use(authenticate, requireRole('admin'));
adminRouter.get('/', asyncHandler(async (req, res) => {
  const pg = parsePage(req.query);
  const filter = {};
  if (req.query.owner !== undefined) {
    if (!mongoose.isValidObjectId(req.query.owner)) throw new HttpError(400, 'Invalid owner');
    filter.owner = req.query.owner;
  }
  const [items, total] = await Promise.all([
    Note.find(filter).sort({ _id: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    Note.countDocuments(filter),
  ]);
  res.json(pageResult(items, total, pg));
}));

module.exports = router;
module.exports.adminRouter = adminRouter;
