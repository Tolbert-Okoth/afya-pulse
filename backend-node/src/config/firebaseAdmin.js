const admin = require('firebase-admin');

let serviceAccount;

try {
  // 1. PRODUCTION: Check if the JSON string exists in Environment Variables
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log("🔥 Loading Firebase credentials from Environment Variable...");
    
    // Parse the JSON string from environment
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    // CRITICAL FIX: Render/Vercel escape newlines in env vars. 
    // We must convert literal "\n" strings into actual newline characters.
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  } 
  // 2. LOCAL DEV: Fallback to the local file
  else {
    console.log("💻 Loading Firebase credentials from local file...");
    // Using path join for better cross-platform compatibility
    const serviceAccountPath = require('./serviceAccountKey.json');
    serviceAccount = serviceAccountPath;
  }

  // Prevent re-initialization if the app already exists (useful in some cloud environments)
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ Firebase Admin Initialized successfully.");
  }

} catch (error) {
  console.error("❌ Firebase Initialization Error:", error.message);
  // Suggesting more detail for debugging
  if (error.message.includes('Unexpected token')) {
    console.error("👉 Check if FIREBASE_SERVICE_ACCOUNT in Render is a valid JSON string.");
  }
}

module.exports = admin;