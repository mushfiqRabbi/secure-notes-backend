const { startDb, stopDb, clearDb, createUser } = require('./helpers');
const request = require('supertest');
const { createApp } = require('../src/app');
const User = require('../src/models/user');

const app = createApp();

beforeAll(async () => {
  await startDb();
  await User.syncIndexes();
});
afterAll(stopDb);
beforeEach(clearDb);

async function seed() {
  const admin = await createUser({ role: 'admin' });
  const a = await createUser({ name: 'A', interests: ['chess', 'reading'] });
  const b = await createUser({ name: 'B', interests: ['chess'] });
  await createUser({ name: 'C', interests: [] });
  return { admin, a, b };
}

test('groups users by interest with counts; users without interests are skipped', async () => {
  const { admin } = await seed();
  const res = await request(app).get('/users/by-interest').set(admin.auth);
  expect(res.status).toBe(200);
  const byName = Object.fromEntries(res.body.items.map((g) => [g.interest, g]));
  expect(Object.keys(byName).sort()).toEqual(['chess', 'reading']);
  expect(byName.chess.count).toBe(2);
  expect(byName.chess.users.map((u) => u.name).sort()).toEqual(['A', 'B']);
  expect(byName.reading.count).toBe(1);
  expect(res.body.total).toBe(2);
  expect(JSON.stringify(res.body)).not.toMatch(/email|passwordHash/);
});

test('?interest= returns only that group', async () => {
  const { admin } = await seed();
  const res = await request(app).get('/users/by-interest?interest=chess').set(admin.auth);
  expect(res.body.items).toHaveLength(1);
  expect(res.body.items[0].interest).toBe('chess');
  expect(res.body.items[0].users).toHaveLength(2);
});

test('unknown interest -> empty page', async () => {
  const { admin } = await seed();
  const res = await request(app).get('/users/by-interest?interest=golf').set(admin.auth);
  expect(res.status).toBe(200);
  expect(res.body.items).toEqual([]);
  expect(res.body.total).toBe(0);
});

test('pagination over groups', async () => {
  const { admin } = await seed();
  const p1 = await request(app).get('/users/by-interest?limit=1&page=1').set(admin.auth);
  const p2 = await request(app).get('/users/by-interest?limit=1&page=2').set(admin.auth);
  expect(p1.body.items.map((g) => g.interest)).toEqual(['chess']);
  expect(p2.body.items.map((g) => g.interest)).toEqual(['reading']);
  expect(p1.body.total).toBe(2);
  expect(p1.body.pages).toBe(2);
});

test('duplicates inside one user array count the user once', async () => {
  const admin = await createUser({ role: 'admin' });
  // Bypass the API normalisation to prove the pipeline itself dedupes.
  await User.collection.insertOne({
    name: 'Dup', email: 'dup@example.com', passwordHash: 'x', role: 'user', interests: ['chess', 'chess'],
  });
  const res = await request(app).get('/users/by-interest').set(admin.auth);
  expect(res.body.items[0]).toMatchObject({ interest: 'chess', count: 1 });
});

test('non-admin -> 403', async () => {
  const u = await createUser();
  expect((await request(app).get('/users/by-interest').set(u.auth)).status).toBe(403);
});
