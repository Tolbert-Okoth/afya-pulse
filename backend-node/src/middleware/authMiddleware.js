const admin = require('../config/firebaseAdmin');
const pool = require('../config/db');

/**
 * verifyToken Middleware
 * 1. Validates the Firebase JWT.
 * 2. Checks if the user exists in Neon PostgreSQL.
 * 3. Injects user data into the request object.
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("🚫 Auth: No Bearer token provided");
      return res.status(403).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // 1. Verify with Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);
    const firebaseUid = decodedToken.uid;

    // 2. Lookup in Postgres (Neon)
    // We wrap this in a sub-try/catch to catch DB-specific ECONNREFUSED issues
    let dbResult;
    try {
      const query = 'SELECT id, email, role FROM users WHERE firebase_uid = $1';
      dbResult = await pool.query(query, [firebaseUid]);
    } catch (dbErr) {
      console.error("❌ Database Connection Error during auth:", dbErr.message);
      return res.status(500).json({ error: 'Internal Database Error', details: dbErr.message });
    }

    // 3. Attach user data to req object
    req.user = {
      uid: firebaseUid,
      email: decodedToken.email,
      id: dbResult.rows.length > 0 ? dbResult.rows[0].id : null,
      role: dbResult.rows.length > 0 ? dbResult.rows[0].role : null
    };

    // 4. THE SYNC LOGIC:
    // If the user doesn't have a Postgres ID yet, they are ONLY allowed to hit the /sync route.
    const isSyncRoute = req.path.includes('/sync') || req.originalUrl.includes('/sync');
    
    if (!req.user.id && !isSyncRoute) {
      console.warn(`⚠️ Blocked: User ${req.user.email} not synced in DB and tried to access ${req.path}`);
      return res.status(403).json({ error: 'User not registered. Please sync account first.' });
    }

    next();
  } catch (error) {
    console.error('❌ Auth Verification Failed:', error.message);
    return res.status(403).json({ error: 'Unauthorized', details: error.message });
  }
};

module.exports = { verifyToken };