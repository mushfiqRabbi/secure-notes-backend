const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 10000 },
  },
  { timestamps: true }
);

// User's own list (equality on owner + newest-first via _id) and the admin ?owner= filter.
// Admin "all notes" sorts by _id using the default index, so no other index is needed;
// the {owner} prefix also makes a separate owner index redundant (cascade delete uses it).
schema.index({ owner: 1, _id: -1 });

module.exports = mongoose.model('Note', schema);
