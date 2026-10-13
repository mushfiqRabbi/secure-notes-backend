require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/secure-notes',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

if (!config.jwtSecret && process.env.NODE_ENV !== 'test') {
  throw new Error('JWT_SECRET must be set');
}

module.exports = config;
