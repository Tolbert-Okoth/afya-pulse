require('dotenv').config();
const { Pool, Client } = require('pg');
const ws = require('ws');
const { neonConfig } = require('@neondatabase/serverless');

// 💡 This is the magic line that fixes "fetch failed" and "ECONNREFUSED"
// It routes the standard Postgres traffic through a WebSocket
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : "";

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

console.log("📡 Neon Connection: Attempting WebSocket Tunnel...");

const testConnection = async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    console.log('✅ NEON CONNECTED: WebSocket Handshake Successful!');
    console.log('🕒 Server Time:', res.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌ NEON CONNECTION FAILED');
    console.error('📋 Code:', err.code || 'N/A');
    console.error('📋 Message:', err.message);
    
    if (connectionString.includes('pooler')) {
       console.log('💡 Tip: Try removing "-pooler" from your DATABASE_URL in Render.');
    }
  }
};

testConnection();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};