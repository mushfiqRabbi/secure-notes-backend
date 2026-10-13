const mongoose = require('mongoose');

const connect = (uri) => mongoose.connect(uri);
const disconnect = () => mongoose.disconnect();

module.exports = { connect, disconnect };
