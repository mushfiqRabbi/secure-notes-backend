const config = require('./config');
const { connect } = require('./db');
const { createApp } = require('./app');

connect(config.mongoUri)
  .then(() => {
    createApp().listen(config.port, () => console.log(`API listening on :${config.port}`));
  })
  .catch((err) => {
    console.error('Failed to start', err);
    process.exit(1);
  });
