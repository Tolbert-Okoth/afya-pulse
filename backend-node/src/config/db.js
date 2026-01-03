require('dotenv').config();
const { Pool } = require('pg');

// Create a connection pool with SSL requirements for Production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // Required for Render/Neon to accept the connection
  } : false
});

// Event listener for successful connection
pool.on('connect', () => {
  console.log('✅ Connected to the PostgreSQL Database');
});

// Event listener for errors
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  // Optional: Don't exit in production if you want the server to attempt recovery
  if (process.env.NODE_ENV !== 'production') {
    process.exit(-1);
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool // Exporting pool itself in case you need it for specialized tasks
};