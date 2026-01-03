require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

// Clean and validate the URL
const connectionString = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : "";

// Initialize Neon HTTP
const sql = neon(connectionString);

console.log("📡 Neon HTTP: Connecting to Direct Instance (Non-Pooler)");

const testConnection = async () => {
  try {
    const result = await sql`SELECT NOW() as time`;
    console.log('✅ NEON SUCCESS: Connected to ep-wandering-union! Time:', result[0].time);
  } catch (err) {
    console.error('❌ NEON HTTP FAILED');
    console.error('📋 Message:', err.message);
    
    if (connectionString.includes('-pooler')) {
      console.log('🚨 ERROR: You are still using the POOLER URL. Switch to the DIRECT URL in Render.');
    }
  }
};

testConnection();

module.exports = {
  query: async (text, params) => {
    try {
      // Compatibility wrapper for your existing code
      const result = await sql(text, params);
      return { rows: result };
    } catch (error) {
      console.error('❌ DB Query Error:', error.message);
      throw error;
    }
  }
};