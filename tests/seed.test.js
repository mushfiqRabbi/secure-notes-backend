const { startDb, stopDb, clearDb } = require('./helpers');
const bcrypt = require('bcrypt');
const User = require('../src/models/user');
const { seedAdmin } = require('../scripts/seed-admin');

beforeAll(async () => {
  await startDb();
  await User.syncIndexes();
});
afterAll(stopDb);
beforeEach(clearDb);

test('creates an admin with a hashed password', async () => {
  await seedAdmin({ email: 'Root@Example.com', password: 'supersecret1', name: 'Root' });
  const u = await User.findOne({ email: 'root@example.com' }).select('+passwordHash');
  expect(u.role).toBe('admin');
  expect(await bcrypt.compare('supersecret1', u.passwordHash)).toBe(true);
});

test('is idempotent and promotes an existing user', async () => {
  await User.create({ name: 'X', email: 'x@example.com', passwordHash: 'h', role: 'user' });
  await seedAdmin({ email: 'x@example.com', password: 'supersecret1', name: 'X' });
  await seedAdmin({ email: 'x@example.com', password: 'supersecret1', name: 'X' });
  expect(await User.countDocuments({ email: 'x@example.com' })).toBe(1);
  expect((await User.findOne({ email: 'x@example.com' })).role).toBe('admin');
});

test('rejects a short password', async () => {
  await expect(seedAdmin({ email: 'a@example.com', password: 'short', name: 'A' })).rejects.toThrow();
});
