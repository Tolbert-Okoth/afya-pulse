require('dotenv').config();
const { Pool } = require('pg');

// 1. Clean the string
const connectionString = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : "";

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false, 
  },
  // Neon works best with these specific settings when using a pooler
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// 2. Immediate Diagnostic with detailed logging
const testConnection = async () => {
  try {
    console.log("📡 Initializing Neon Handshake...");
    // Use a simple query to wake up the compute instance
    const res = await pool.query('SELECT 1');
    if (res) {
      console.log('✅ NEON CONNECTED: Database is active and responding.');
    }
  } catch (err) {
    console.error('❌ NEON CONNECTION ERROR');
    console.error('📋 Code:', err.code);
    console.error('📋 Message:', err.message || "No message returned (Check SSL/URL)");
    
    // Check if the URL contains the pooler suffix
    if (connectionString.includes('-pooler')) {
      console.log('💡 TIP: You are using a pooled connection. Ensure "Connection Pooling" is ENABLED in the Neon console.');
    }
  }
};

testConnection();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};