const { startDb, stopDb, clearDb, createUser } = require('./helpers');
const request = require('supertest');
const { createApp } = require('../src/app');
const User = require('../src/models/user');
const Post = require('../src/models/post');

const app = createApp();

beforeAll(async () => {
  await startDb();
  await User.syncIndexes();
  await Post.syncIndexes();
});
afterAll(stopDb);
beforeEach(clearDb);

const write = (auth, title) => request(app).post('/posts').set(auth).send({ title, body: 'b' });

test('POST /posts needs auth and validates', async () => {
  expect((await request(app).post('/posts').send({ title: 't' })).status).toBe(401);
  const u = await createUser();
  expect((await request(app).post('/posts').set(u.auth).send({})).status).toBe(400);
  const ok = await write(u.auth, 'hello');
  expect(ok.status).toBe(201);
  expect(ok.body.author).toBe(u.id);
});

test('public user-posts: no auth, only that user, newest first', async () => {
  const a = await createUser({ name: 'Alice' });
  const b = await createUser();
  await write(a.auth, 'a1');
  await write(b.auth, 'b1');
  await write(a.auth, 'a2');
  const res = await request(app).get(`/users/${a.id}/posts`);
  expect(res.status).toBe(200);
  expect(res.body.user).toEqual({ _id: a.id, name: 'Alice' });
  expect(res.body.posts.map((p) => p.title)).toEqual(['a2', 'a1']);
  expect(res.body.total).toBe(2);
  expect(JSON.stringify(res.body)).not.toMatch(/email|passwordHash/);
});

test('user with no posts -> posts []', async () => {
  const a = await createUser();
  const res = await request(app).get(`/users/${a.id}/posts`);
  expect(res.status).toBe(200);
  expect(res.body.posts).toEqual([]);
  expect(res.body.total).toBe(0);
  expect(res.body.user._id).toBe(a.id);
});

test('unknown user -> 404, bad id -> 400', async () => {
  expect((await request(app).get('/users/507f1f77bcf86cd799439011/posts')).status).toBe(404);
  expect((await request(app).get('/users/nope/posts')).status).toBe(400);
});

test('pagination', async () => {
  const a = await createUser();
  for (const t of ['p1', 'p2', 'p3']) await write(a.auth, t);
  const res = await request(app).get(`/users/${a.id}/posts?limit=2&page=2`);
  expect(res.body.posts.map((p) => p.title)).toEqual(['p1']);
  expect(res.body.total).toBe(3);
  expect(res.body.pages).toBe(2);
  expect(res.body.page).toBe(2);
});
