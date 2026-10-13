const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 10000 },
  },
  { timestamps: true }
);

// Foreign-field index for the Scenario 2 $lookup, with newest-first sort inside the sub-pipeline.
schema.index({ author: 1, _id: -1 });

module.exports = mongoose.model('Post', schema);
