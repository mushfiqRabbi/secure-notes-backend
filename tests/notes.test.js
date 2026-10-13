const { startDb, stopDb, clearDb, createUser } = require('./helpers');
const request = require('supertest');
const { createApp } = require('../src/app');
const Note = require('../src/models/note');

const app = createApp();

beforeAll(async () => {
  await startDb();
  await Note.syncIndexes();
});
afterAll(stopDb);
beforeEach(clearDb);

const mk = (auth, title) => request(app).post('/notes').set(auth).send({ title, body: `${title} body` });

test('unauthenticated -> 401', async () => {
  expect((await request(app).get('/notes')).status).toBe(401);
});

test('create + list own notes newest first with pagination', async () => {
  const a = await createUser();
  for (const t of ['n1', 'n2', 'n3']) expect((await mk(a.auth, t)).status).toBe(201);
  const all = await request(app).get('/notes').set(a.auth);
  expect(all.body.items.map((n) => n.title)).toEqual(['n3', 'n2', 'n1']);
  expect(all.body.total).toBe(3);
  const p2 = await request(app).get('/notes?limit=2&page=2').set(a.auth);
  expect(p2.body.items.map((n) => n.title)).toEqual(['n1']);
  expect(p2.body.pages).toBe(2);
});

test('list returns only the caller\'s notes', async () => {
  const a = await createUser();
  const b = await createUser();
  await mk(a.auth, 'a-note');
  await mk(b.auth, 'b-note');
  const res = await request(app).get('/notes').set(b.auth);
  expect(res.body.items.map((n) => n.title)).toEqual(['b-note']);
});

test('other user gets 404 on get/patch/delete and note is unchanged', async () => {
  const a = await createUser();
  const b = await createUser();
  const { body: note } = await mk(a.auth, 'secret');
  expect((await request(app).get(`/notes/${note._id}`).set(b.auth)).status).toBe(404);
  expect((await request(app).patch(`/notes/${note._id}`).set(b.auth).send({ title: 'x' })).status).toBe(404);
  expect((await request(app).delete(`/notes/${note._id}`).set(b.auth)).status).toBe(404);
  expect((await Note.findById(note._id)).title).toBe('secret');
});

test('owner can update and delete; owner field cannot be changed', async () => {
  const a = await createUser();
  const b = await createUser();
  const { body: note } = await mk(a.auth, 'old');
  const up = await request(app).patch(`/notes/${note._id}`).set(a.auth).send({ title: 'new', owner: b.id });
  expect(up.status).toBe(200);
  expect(up.body.title).toBe('new');
  expect(up.body.owner).toBe(a.id);
  expect((await request(app).delete(`/notes/${note._id}`).set(a.auth)).status).toBe(204);
  expect(await Note.countDocuments()).toBe(0);
});

test('admin can read another user\'s note by id', async () => {
  const a = await createUser();
  const admin = await createUser({ role: 'admin' });
  const { body: note } = await mk(a.auth, 'visible');
  expect((await request(app).get(`/notes/${note._id}`).set(admin.auth)).status).toBe(200);
});

test('admin can list all notes, filter by owner; users cannot', async () => {
  const a = await createUser();
  const b = await createUser();
  const admin = await createUser({ role: 'admin' });
  await mk(a.auth, 'a1');
  await mk(b.auth, 'b1');
  await mk(b.auth, 'b2');
  expect((await request(app).get('/admin/notes').set(a.auth)).status).toBe(403);
  const all = await request(app).get('/admin/notes').set(admin.auth);
  expect(all.body.total).toBe(3);
  expect(all.body.items.map((n) => n.title)).toEqual(['b2', 'b1', 'a1']);
  const only = await request(app).get(`/admin/notes?owner=${b.id}`).set(admin.auth);
  expect(only.body.items.map((n) => n.title)).toEqual(['b2', 'b1']);
  expect((await request(app).get('/admin/notes?owner=bad').set(admin.auth)).status).toBe(400);
});

test('validation and bad ids', async () => {
  const a = await createUser();
  expect((await request(app).post('/notes').set(a.auth).send({ body: 'no title' })).status).toBe(400);
  expect((await request(app).get('/notes/not-an-id').set(a.auth)).status).toBe(400);
  expect((await request(app).get('/notes/507f1f77bcf86cd799439011').set(a.auth)).status).toBe(404);
});
