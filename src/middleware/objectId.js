const mongoose = require('mongoose');
const { HttpError } = require('../lib/httpError');

const validateObjectId = (name) => (req, _res, next) =>
  mongoose.isValidObjectId(req.params[name]) ? next() : next(new HttpError(400, `Invalid ${name}`));

module.exports = { validateObjectId };
