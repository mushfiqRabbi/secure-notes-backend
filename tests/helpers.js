const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const bcrypt = require('bcrypt');

let mongod;
let counter = 0;


module.exports = {
  async startDb() {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  },
  async stopDb() {
    await mongoose.disconnect();
    await mongod.stop();
  },
  // Creates a user directly (so admins can be made) and returns a ready Authorization header.
  async createUser({ role = 'user', interests = [], name, email, password = 'password123' } = {}) {
    const User = require('../src/models/user');
    const { signToken } = require('../src/middleware/auth');
    counter += 1;
    const user = await User.create({
      name: name || `User ${counter}`,
      email: email || `user${counter}@example.com`,
      passwordHash: await bcrypt.hash(password, 4),
      role,
      interests,
    });
    return { user, id: String(user._id), auth: { Authorization: `Bearer ${signToken(user)}` } };
  },
  async clearDb() {
    for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
  },
};
