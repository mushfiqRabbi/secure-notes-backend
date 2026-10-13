const User = require('../models/user');

// Scenario 1: users grouped by interest, in exactly ONE User.aggregate() call.
// Page of groups and the total number of groups both come from a single $facet.
//   $match {interests: <x>}   -> multikey {interests:1} when an interest filter is given
//   $setUnion                 -> a user listing the same interest twice counts once
//   second $match after $unwind keeps only the requested group (the first one selects users)
function buildInterestPipeline({ interest, skip, limit }) {
  const pipeline = [
    {
      $match: interest
        ? { interests: interest }
        : { interests: { $exists: true, $ne: [] } },
    },
    { $project: { name: 1, interests: { $setUnion: ['$interests', []] } } },
    { $unwind: '$interests' },
  ];
  if (interest) pipeline.push({ $match: { interests: interest } });
  pipeline.push(
    {
      $group: {
        _id: '$interests',
        count: { $sum: 1 },
        users: { $push: { _id: '$_id', name: '$name' } },
      },
    },
    { $sort: { _id: 1 } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          { $project: { _id: 0, interest: '$_id', count: 1, users: 1 } },
        ],
        meta: [{ $count: 'total' }],
      },
    }
  );
  return pipeline;
}

async function groupUsersByInterest(params) {
  const [result] = await User.aggregate(buildInterestPipeline(params));
  return { items: result.items, total: result.meta[0] ? result.meta[0].total : 0 };
}

module.exports = { groupUsersByInterest, buildInterestPipeline };
