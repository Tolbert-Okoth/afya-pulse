const admin = require('firebase-admin');
const path = require('path');

let serviceAccount;

try {
  // 1. PRODUCTION: Check if the JSON string exists in Environment Variables
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log("🔥 Loading Firebase credentials from Environment Variable...");
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } 
  // 2. LOCAL DEV: Fallback to the local file
  else {
    console.log("💻 Loading Firebase credentials from local file...");
    serviceAccount = require('./serviceAccountKey.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log("✅ Firebase Admin Initialized successfully.");

} catch (error) {
  console.error("❌ Firebase Initialization Error:", error.message);
  // We don't exit process here so the rest of the server can might still try to start, 
  // but usually this is a fatal error for auth.
}

module.exports = admin;