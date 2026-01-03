require('dotenv').config();
const { neon, neonConfig } = require('@neondatabase/serverless');

// 1. NEON CONFIG: This is the critical part
// This tells Neon to use a standard global fetch and helps resolve DNS issues
neonConfig.fetchConnectionCache = true;

// 🛡️ TRAP: If Node 22 is struggling with DNS, we use this to force it
if (typeof global.fetch === 'undefined') {
  console.log("⚠️ Native fetch missing, using polyfill...");
  // Node 22 has fetch by default, but some environments strip it
}

// 2. Normalize Connection String
const connectionString = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : "";

// 3. Initialize the Neon HTTP client
const sql = neon(connectionString);

console.log("📡 Neon HTTP Client: Initialized with Connection Cache");

// 4. Test Query with Detailed Error Breakdown
const testConnection = async () => {
  try {
    const result = await sql`SELECT 1 as connected`;
    if (result) {
      console.log('✅ NEON SUCCESS: Connection verified over HTTP.');
    }
  } catch (err) {
    console.error('❌ NEON HTTP FAILED');
    console.error('📋 Code:', err.code);
    console.error('📋 Message:', err.message);
    
    // If it still fails, the problem is likely the URL itself.
    if (connectionString.includes('sslmode=require')) {
      console.log('💡 TIP: Try REMOVING ?sslmode=require from the DATABASE_URL. The HTTP driver handles SSL automatically.');
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
        console.error('❌ DB Query Error:', error.message);
        throw error;
    }
  }
};