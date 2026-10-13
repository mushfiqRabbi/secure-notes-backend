const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

let mongod;

module.exports = {
  async startDb() {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  },
  async stopDb() {
    await mongoose.disconnect();
    await mongod.stop();
  },
  async clearDb() {
    for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
  },
};
