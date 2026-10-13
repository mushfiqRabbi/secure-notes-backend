const { startDb, stopDb } = require('./helpers');
const mongoose = require('mongoose');
const User = require('../src/models/user');
const Note = require('../src/models/note');
const Post = require('../src/models/post');
const { buildInterestPipeline } = require('../src/services/interestGroups');
const { buildUserPostsPipeline } = require('../src/services/userPosts');

const { ObjectId } = mongoose.Types;
const owner = new ObjectId();
let someUser;

// Collect the stage names and index names used anywhere in an explain document.
const inspect = (explain) => {
  const stages = new Set();
  const indexes = new Set();
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === 'object') {
      if (typeof n.stage === 'string') stages.add(n.stage);
      if (typeof n.indexName === 'string') indexes.add(n.indexName);
      if (Array.isArray(n.indexesUsed)) n.indexesUsed.forEach((i) => indexes.add(i));
      Object.values(n).forEach(walk);
    }
  };
  walk(explain);
  return { stages, indexes };
};

beforeAll(async () => {
  await startDb();
  await Promise.all([User.syncIndexes(), Note.syncIndexes(), Post.syncIndexes()]);
  const users = Array.from({ length: 200 }, (_, i) => ({
    name: `u${i}`, email: `u${i}@x.com`, passwordHash: 'x',
    interests: i % 2 ? ['chess', 'reading'] : ['golf'],
  }));
  const inserted = await User.insertMany(users);
  someUser = inserted[0]._id;
  await Note.insertMany(Array.from({ length: 200 }, (_, i) => ({ owner: i % 2 ? owner : new ObjectId(), title: `n${i}` })));
  await Post.insertMany(Array.from({ length: 200 }, (_, i) => ({ author: i % 2 ? someUser : new ObjectId(), title: `p${i}` })));
});
afterAll(stopDb);

const plan = async (query) => inspect(await query.explain('queryPlanner'));
const usesIndex = (r, name) => {
  expect(r.stages.has('COLLSCAN')).toBe(false);
  expect(r.stages.has('IXSCAN')).toBe(true);
  expect(r.indexes.has(name)).toBe(true);
};
// Point lookups on _id use a server fast path (IDHACK / EXPRESS_IXSCAN depending on version);
// what matters is that no COLLSCAN happens and the _id_ index is the one read.
const usesIdIndex = (r) => {
  expect(r.stages.has('COLLSCAN')).toBe(false);
  expect(r.indexes.has('_id_')).toBe(true);
};


test('user notes list -> owner_1__id_-1', async () =>
  usesIndex(await plan(Note.find({ owner }).sort({ _id: -1 }).limit(20)), 'owner_1__id_-1'));
test('admin all notes -> _id_', async () =>
  usesIndex(await plan(Note.find({}).sort({ _id: -1 }).limit(20)), '_id_'));
test('admin notes by owner -> owner_1__id_-1', async () =>
  usesIndex(await plan(Note.find({ owner }).sort({ _id: -1 })), 'owner_1__id_-1'));
test('note by id -> _id_', async () => usesIdIndex(await plan(Note.findById(new ObjectId()))));
test('posts of author -> author_1__id_-1', async () =>
  usesIndex(await plan(Post.find({ author: someUser }).sort({ _id: -1 })), 'author_1__id_-1'));
test('login by email -> email_1', async () =>
  usesIndex(await plan(User.find({ email: 'u1@x.com' })), 'email_1'));
test('admin users list -> _id_', async () =>
  usesIndex(await plan(User.find().sort({ _id: -1 }).limit(20)), '_id_'));
test('user by id -> _id_', async () => usesIdIndex(await plan(User.findById(someUser))));
test('users by interest -> interests_1', async () =>
  usesIndex(await plan(User.find({ interests: 'chess' })), 'interests_1'));

test('Scenario 1 pipeline with interest filter starts on interests_1', async () => {
  const exp = await User.aggregate(buildInterestPipeline({ interest: 'chess', skip: 0, limit: 20 }))
    .explain('queryPlanner');
  usesIndex(inspect(exp), 'interests_1');
});

test('Scenario 2 pipeline: $match on _id_ and $lookup uses author_1__id_-1', async () => {
  const exp = await User.aggregate(buildUserPostsPipeline(String(someUser), { skip: 0, limit: 20 }))
    .explain('executionStats');
  const r = inspect(exp);
  expect(r.indexes.has('_id_')).toBe(true);
  expect(r.indexes.has('author_1__id_-1')).toBe(true);
  expect(r.stages.has('COLLSCAN')).toBe(false);
});
