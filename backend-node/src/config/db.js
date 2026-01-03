require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

// 1. Force the protocol to be correct and trim any hidden whitespace
let connectionString = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : "";

// Fix: Neon HTTP driver sometimes prefers 'postgres://' for the fetch handshake
if (connectionString.startsWith('postgresql://')) {
  connectionString = connectionString.replace('postgresql://', 'postgres://');
}

// 2. Initialize the Neon HTTP client
const sql = neon(connectionString);

console.log("📡 Neon HTTP Diagnostic: Attempting connection via Port 443");

// 3. Startup Handshake Test
const testConnection = async () => {
  try {
    // Simple query to verify connectivity
    const result = await sql`SELECT 1 as connected`;
    if (result) {
      console.log('✅ NEON HTTP SUCCESS: Handshake completed over Port 443');
    }
  } catch (err) {
    console.error('❌ NEON HTTP CONNECTION FAILED');
    console.error('📋 Error Message:', err.message);
    
    // Additional debugging for Render logs
    if (err.message.includes('fetch failed')) {
      console.log('💡 DEBUG: This usually means the hostname in DATABASE_URL is unreachable. Check your Neon Project region.');
    }
  }
};

testConnection();

module.exports = {
  query: async (text, params) => {
    try {
        const result = await sql(text, params);
        return { rows: result };
    } catch (error) {
        console.error('❌ Database Query Error:', error.message);
        throw error;
    }
  }
};