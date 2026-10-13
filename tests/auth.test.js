const { startDb, stopDb, clearDb } = require('./helpers');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { createApp } = require('../src/app');
const User = require('../src/models/user');

const app = createApp();
const valid = { name: 'Ann', email: 'ann@example.com', password: 'password123' };

beforeAll(async () => {
  await startDb();
  await User.syncIndexes();
});
afterAll(stopDb);
beforeEach(clearDb);

test('register returns token and user without passwordHash; hash is bcrypt', async () => {
  const res = await request(app).post('/auth/register').send(valid);
  expect(res.status).toBe(201);
  expect(res.body.token).toBeTruthy();
  expect(res.body.user.email).toBe('ann@example.com');
  expect(res.body.user.passwordHash).toBeUndefined();
  const stored = await User.findOne({ email: valid.email }).select('+passwordHash');
  expect(stored.passwordHash.startsWith('$2')).toBe(true);
  expect(stored.passwordHash).not.toBe(valid.password);
  expect(await bcrypt.compare(valid.password, stored.passwordHash)).toBe(true);
});

test('register ignores role from the body', async () => {
  const res = await request(app).post('/auth/register').send({ ...valid, role: 'admin' });
  expect(res.status).toBe(201);
  expect(res.body.user.role).toBe('user');
});

test('duplicate email (different case) -> 409', async () => {
  await request(app).post('/auth/register').send(valid);
  const res = await request(app).post('/auth/register').send({ ...valid, email: 'ANN@example.com' });
  expect(res.status).toBe(409);
});

test('short password -> 400', async () => {
  const res = await request(app).post('/auth/register').send({ ...valid, password: 'short' });
  expect(res.status).toBe(400);
});

test('login: wrong password 401, unknown email 401, right password 200', async () => {
  await request(app).post('/auth/register').send(valid);
  const bad = await request(app).post('/auth/login').send({ email: valid.email, password: 'nope-nope' });
  expect(bad.status).toBe(401);
  const unknown = await request(app).post('/auth/login').send({ email: 'x@example.com', password: 'password123' });
  expect(unknown.status).toBe(401);
  expect(unknown.body.error).toBe(bad.body.error);
  const ok = await request(app).post('/auth/login').send({ email: valid.email, password: valid.password });
  expect(ok.status).toBe(200);
  expect(ok.body.token).toBeTruthy();
});

test('GET /me: 401 without token, 200 with token', async () => {
  expect((await request(app).get('/me')).status).toBe(401);
  const { body } = await request(app).post('/auth/register').send(valid);
  const res = await request(app).get('/me').set('Authorization', `Bearer ${body.token}`);
  expect(res.status).toBe(200);
  expect(res.body.email).toBe(valid.email);
  expect(res.body.passwordHash).toBeUndefined();
});

test('token of a deleted user -> 401', async () => {
  const { body } = await request(app).post('/auth/register').send(valid);
  await User.deleteOne({ _id: body.user._id });
  const res = await request(app).get('/me').set('Authorization', `Bearer ${body.token}`);
  expect(res.status).toBe(401);
});

test('garbage token -> 401', async () => {
  const res = await request(app).get('/me').set('Authorization', 'Bearer abc.def.ghi');
  expect(res.status).toBe(401);
});

test('PATCH /me cannot change role; can change name, interests and password', async () => {
  const { body } = await request(app).post('/auth/register').send(valid);
  const auth = { Authorization: `Bearer ${body.token}` };
  const res = await request(app)
    .patch('/me')
    .set(auth)
    .send({ role: 'admin', name: 'Anna', interests: ['Chess '], password: 'newpassword1' });
  expect(res.status).toBe(200);
  expect(res.body.role).toBe('user');
  expect(res.body.name).toBe('Anna');
  expect(res.body.interests).toEqual(['chess']);
  const login = await request(app).post('/auth/login').send({ email: valid.email, password: 'newpassword1' });
  expect(login.status).toBe(200);
});
