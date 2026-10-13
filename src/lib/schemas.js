const { z } = require('zod');

const email = z.string().trim().toLowerCase().email().max(254);
// bcrypt only uses the first 72 bytes, so cap the length instead of silently truncating.
const password = z.string().min(8).max(72);
const name = z.string().trim().min(1).max(100);
const interests = z
  .array(z.string().trim().toLowerCase().min(1).max(50))
  .max(20)
  .transform((list) => [...new Set(list)]);

module.exports = { email, password, name, interests };
