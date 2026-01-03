require('dotenv').config();
const { Pool } = require('pg');

// 1. Ensure the URL exists and is trimmed of accidental whitespace
const rawConnectionString = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : "";

const pool = new Pool({
  connectionString: rawConnectionString,
  ssl: {
    rejectUnauthorized: false, // Required for Neon's self-signed certs
  },
  // Higher timeouts to give Neon time to "wake up" from its sleep state
  connectionTimeoutMillis: 15000, 
  idleTimeoutMillis: 30000,
  max: 10
});

// 2. Immediate Diagnostic Test
const testConnection = async () => {
  try {
    console.log("📡 Attempting Neon Handshake...");
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Neon Database Connected! Server Time:', res.rows[0].now);
  } catch (err) {
    console.error('❌ CRITICAL: Neon Connection Failed.');
    console.error('📋 Error Code:', err.code);
    console.error('📋 Error Message:', err.message);
    
    if (err.message.includes('getaddrinfo')) {
      console.error('👉 Tip: Check if your DATABASE_URL hostname is correct.');
    }
    if (err.message.includes('SSL')) {
      console.error('👉 Tip: Ensure ?sslmode=require is in your connection string.');
    }
  }
};

testConnection();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};