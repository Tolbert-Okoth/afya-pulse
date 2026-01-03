const admin = require('../config/firebaseAdmin');
const pool = require('../config/db');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(403).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];

    // --- TRACKER A: FIREBASE CHECK ---
    console.log("🔍 Debug: Attempting Firebase Token Verification...");
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log("✅ Debug: Firebase Token Verified for:", decodedToken.email);
    } catch (fbError) {
      console.error("❌ Debug: Firebase Verification Error:", fbError.code, fbError.message);
      throw fbError; // Re-throw to be caught by the main catch block
    }

    const firebaseUid = decodedToken.uid;

    // --- TRACKER B: DATABASE CHECK ---
    console.log("🔍 Debug: Attempting Database User Lookup...");
    let result;
    try {
      const query = 'SELECT id, email, role FROM users WHERE firebase_uid = $1';
      result = await pool.query(query, [firebaseUid]);
      console.log("✅ Debug: Database Lookup Successful.");
    } catch (dbError) {
      console.error("❌ Debug: Database Connection Error:", dbError.code, dbError.message);
      throw dbError; // This is likely where ECONNREFUSED is coming from
    }

    req.user = {
      uid: firebaseUid,
      email: decodedToken.email,
      id: result.rows.length > 0 ? result.rows[0].id : null,
      role: result.rows.length > 0 ? result.rows[0].role : null
    };

    next();

  } catch (error) {
    // This logs the ultimate cause of the ECONNREFUSED
    console.error('❌ Final Auth Error Details:', {
      message: error.message,
      code: error.code,
      syscall: error.syscall, // This will say 'connect' or 'getaddrinfo'
      address: error.address, // This will show the IP (Google vs Postgres)
    });
    
    return res.status(403).json({ error: 'Unauthorized', details: error.message });
  }
};

module.exports = { verifyToken };