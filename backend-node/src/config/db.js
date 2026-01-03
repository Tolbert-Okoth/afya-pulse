// FILE: backend-node/src/config/db.js
require('dotenv').config();
const { Pool } = require('pg');

// Create a connection pool using the connection string from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Event listener for successful connection
pool.on('connect', () => {
  console.log('✅ Connected to the PostgreSQL Database');
});

// Event listener for errors (important for debugging)
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};