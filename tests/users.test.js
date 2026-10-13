const { startDb, stopDb, clearDb, createUser } = require('./helpers');
const request = require('supertest');
const { createApp } = require('../src/app');
const User = require('../src/models/user');
const Note = require('../src/models/note');
const Post = require('../src/models/post');

const app = createApp();

beforeAll(async () => {
  await startDb();
  await User.syncIndexes();
});
afterAll(stopDb);
beforeEach(clearDb);

test('non-admin gets 403 on every user-management route', async () => {
  const u = await createUser();
  const id = u.id;
  const calls = [
    request(app).get('/users'),
    request(app).get(`/users/${id}`),
    request(app).post('/users').send({}),
    request(app).patch(`/users/${id}`).send({}),
    request(app).delete(`/users/${id}`),
  ];
  for (const c of calls) expect((await c.set(u.auth)).status).toBe(403);
});

test('admin lists users paginated without passwordHash', async () => {
  const admin = await createUser({ role: 'admin' });
  for (let i = 0; i < 4; i += 1) await createUser();
  const res = await request(app).get('/users?limit=2&page=2').set(admin.auth);
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(5);
  expect(res.body.items).toHaveLength(2);
  expect(res.body.pages).toBe(3);
  for (const u of res.body.items) expect(u.passwordHash).toBeUndefined();
});

test('admin creates a user with a role; duplicate email -> 409', async () => {
  const admin = await createUser({ role: 'admin' });
  const body = { name: 'New Admin', email: 'na@example.com', password: 'password123', role: 'admin', interests: ['Chess'] };
  const res = await request(app).post('/users').set(admin.auth).send(body);
  expect(res.status).toBe(201);
  expect(res.body.role).toBe('admin');
  expect(res.body.interests).toEqual(['chess']);
  expect(res.body.passwordHash).toBeUndefined();
  expect((await request(app).post('/users').set(admin.auth).send(body)).status).toBe(409);
});

test('admin gets one user by id; 404 unknown; 400 bad id', async () => {
  const admin = await createUser({ role: 'admin' });
  const u = await createUser();
  expect((await request(app).get(`/users/${u.id}`).set(admin.auth)).body.email).toBe(u.user.email);
  expect((await request(app).get('/users/507f1f77bcf86cd799439011').set(admin.auth)).status).toBe(404);
  expect((await request(app).get('/users/zzz').set(admin.auth)).status).toBe(400);
});

test('admin updates role/name; password change re-hashes', async () => {
  const admin = await createUser({ role: 'admin' });
  const u = await createUser({ email: 'target@example.com', password: 'oldpassword1' });
  const res = await request(app)
    .patch(`/users/${u.id}`)
    .set(admin.auth)
    .send({ role: 'admin', name: 'Renamed', password: 'brandnewpass1' });
  expect(res.status).toBe(200);
  expect(res.body.role).toBe('admin');
  expect(res.body.name).toBe('Renamed');
  const bad = await request(app).post('/auth/login').send({ email: 'target@example.com', password: 'oldpassword1' });
  const good = await request(app).post('/auth/login').send({ email: 'target@example.com', password: 'brandnewpass1' });
  expect(bad.status).toBe(401);
  expect(good.status).toBe(200);
});

test('admin delete cascades notes and posts; cannot delete self', async () => {
  const admin = await createUser({ role: 'admin' });
  const u = await createUser();
  await Note.create({ owner: u.id, title: 't' });
  await Post.create({ author: u.id, title: 'p' });
  expect((await request(app).delete(`/users/${admin.id}`).set(admin.auth)).status).toBe(400);
  expect((await request(app).delete(`/users/${u.id}`).set(admin.auth)).status).toBe(204);
  expect(await User.countDocuments({ _id: u.id })).toBe(0);
  expect(await Note.countDocuments({ owner: u.id })).toBe(0);
  expect(await Post.countDocuments({ author: u.id })).toBe(0);
  expect((await request(app).delete(`/users/${u.id}`).set(admin.auth)).status).toBe(404);
});
