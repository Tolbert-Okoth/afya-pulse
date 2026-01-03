require('dotenv').config();
const { Pool } = require('pg');

// Neon requires the connection string to be parsed correctly
// Make sure your DATABASE_URL in Render ends with ?sslmode=require
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
  // Neon connection optimization
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('✅ Successful Handshake: Connected to Neon PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Neon Database Error:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};