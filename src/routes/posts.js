const router = require('express').Router();
const userPostsRouter = require('express').Router({ mergeParams: true });
const { z } = require('zod');
const Post = require('../models/post');
const { authenticate } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/objectId');
const { asyncHandler, HttpError } = require('../lib/httpError');
const { parsePage, pageResult } = require('../lib/pagination');
const { getUserWithPosts } = require('../services/userPosts');

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(10000).default(''),
});

router.post('/', authenticate, asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);
  res.status(201).json(await Post.create({ ...data, author: req.user.id }));
}));

// Public: posts are visible to everyone. Exposes only the user's _id and name.
userPostsRouter.get('/:id/posts', validateObjectId('id'), asyncHandler(async (req, res) => {
  const pg = parsePage(req.query);
  const doc = await getUserWithPosts(req.params.id, pg);
  if (!doc) throw new HttpError(404, 'User not found');
  const { items, ...meta } = pageResult(doc.posts, doc.total, pg);
  res.json({ user: { _id: String(doc._id), name: doc.name }, posts: items, ...meta });
}));

module.exports = router;
module.exports.userPostsRouter = userPostsRouter;
