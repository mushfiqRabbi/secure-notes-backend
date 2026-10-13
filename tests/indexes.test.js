const { startDb, stopDb } = require('./helpers');
const User = require('../src/models/user');
const Note = require('../src/models/note');
const Post = require('../src/models/post');

beforeAll(startDb);
afterAll(stopDb);

const keys = async (Model) => {
  await Model.syncIndexes();
  return (await Model.collection.indexes()).map((i) => JSON.stringify(i.key)).sort();
};
const k = (o) => JSON.stringify(o);

test('users: _id, email, interests only', async () => {
  expect(await keys(User)).toEqual([k({ _id: 1 }), k({ email: 1 }), k({ interests: 1 })].sort());
});

test('notes: _id and owner+_id only', async () => {
  expect(await keys(Note)).toEqual([k({ _id: 1 }), k({ owner: 1, _id: -1 })].sort());
});

test('posts: _id and author+_id only', async () => {
  expect(await keys(Post)).toEqual([k({ _id: 1 }), k({ author: 1, _id: -1 })].sort());
});

test('email index is unique', async () => {
  await User.syncIndexes();
  const idx = (await User.collection.indexes()).find((i) => i.key.email);
  expect(idx.unique).toBe(true);
});
