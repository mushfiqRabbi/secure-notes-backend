const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    interests: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Login + duplicate-email check (point lookup by email); unique = one account per email.
schema.index({ email: 1 }, { unique: true });
// Multikey index: serves Scenario 1 ($match on interest). Not used by any other query.
schema.index({ interests: 1 });
// Deliberately NOT indexed: admin user list sorts by _id and GET-by-id uses _id (free index).

module.exports = mongoose.model('User', schema);
