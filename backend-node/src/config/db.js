require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

// 1. Clean the string
const connectionString = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : "";

// 2. Initialize the Neon HTTP client (Bypasses traditional TCP/Pooler issues)
const sql = neon(connectionString);

console.log("📡 Neon HTTP Client Initialized (Port 443)");

// 3. Startup Handshake Test
const testConnection = async () => {
  try {
    const result = await sql`SELECT NOW()`;
    console.log('✅ NEON HTTP CONNECTED: Server Time:', result[0].now);
  } catch (err) {
    console.error('❌ NEON HTTP CONNECTION FAILED');
    console.error('📋 Message:', err.message);
    console.error('📋 Hint: Check if your DATABASE_URL is the pooled or direct string.');
  }
};

testConnection();

// 4. Export a wrapper to keep your existing code working (query syntax)
module.exports = {
  query: async (text, params) => {
    // The Neon HTTP driver uses a tagged template or a specific function call.
    // For compatibility with your existing controllers:
    try {
        const result = await sql(text, params);
        return { rows: result };
    } catch (error) {
        throw error;
    }
  }
};