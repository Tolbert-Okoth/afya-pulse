require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
  // ⚡ Neon Specific Optimizations
  max: 20,                   // Allow more concurrent connections
  idleTimeoutMillis: 20000,  // Close idle clients after 20s
  connectionTimeoutMillis: 10000, // Wait 10s for a handshake before failing
});

// Test the connection immediately on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ CRITICAL: Could not connect to Neon PostgreSQL:', err.message);
  } else {
    console.log('✅ Neon Database Handshake Successful at:', res.rows[0].now);
  }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected Neon Pool Error:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};