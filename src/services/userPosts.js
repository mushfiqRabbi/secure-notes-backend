const mongoose = require('mongoose');
const User = require('../models/user');

// Scenario 2: all posts of one user in a single aggregation pipeline using $lookup.
//   $match {_id}                       -> default _id index
//   $lookup posts (author)             -> {author:1,_id:-1}: equality + newest-first sort in the sub-pipeline
// The second $lookup only counts, so pagination metadata comes from the same round trip.
async function getUserWithPosts(userId, { skip, limit }) {
  const [doc] = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: 'posts',
        localField: '_id',
        foreignField: 'author',
        pipeline: [{ $sort: { _id: -1 } }, { $skip: skip }, { $limit: limit }],
        as: 'posts',
      },
    },
    {
      $lookup: {
        from: 'posts',
        localField: '_id',
        foreignField: 'author',
        pipeline: [{ $count: 'n' }],
        as: 'count',
      },
    },
    { $project: { name: 1, posts: 1, total: { $ifNull: [{ $first: '$count.n' }, 0] } } },
  ]);
  return doc || null;
}

module.exports = { getUserWithPosts };
