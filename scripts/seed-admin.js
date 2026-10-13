const bcrypt = require('bcrypt');
const User = require('../src/models/user');

// Upsert by email: creates the admin or promotes/updates an existing account.
async function seedAdmin({ email, password, name }) {
  if (!email || !password || password.length < 8) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) are required');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  return User.findOneAndUpdate(
    { email: email.trim().toLowerCase() },
    { $set: { name: name || 'Admin', passwordHash, role: 'admin' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
}

module.exports = { seedAdmin };

if (require.main === module) {
  const config = require('../src/config');
  const { connect, disconnect } = require('../src/db');
  (async () => {
    await connect(config.mongoUri);
    await User.init();
    const admin = await seedAdmin({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      name: process.env.ADMIN_NAME,
    });
    console.log(`Admin ready: ${admin.email}`);
    await disconnect();
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
