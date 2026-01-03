const admin = require('../config/firebaseAdmin');
const pool = require('../config/db');

/**
 * verifyToken Middleware
 * 1. Validates Firebase JWT
 * 2. Attaches firebase_uid to request
 * 3. Allows /sync without DB presence
 * 4. Blocks protected routes if user not synced
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("🚫 Auth: No Bearer token provided");
      return res.status(403).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];

    // 1. Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);

    if (!decodedToken?.uid) {
      return res.status(403).json({ error: 'Invalid Firebase token' });
    }

    const firebaseUid = decodedToken.uid;

    // 2. Attach Firebase identity early
    req.user = {
      uid: firebaseUid,
      email: decodedToken.email || null
    };

    // 3. Allow /sync route without DB lookup
    const isSyncRoute =
      req.path.includes('/sync') ||
      req.originalUrl.includes('/sync');

    if (isSyncRoute) {
      return next();
    }

    // 4. Lookup user in Postgres
    let dbResult;
    try {
      dbResult = await pool.query(
        'SELECT id, role FROM users WHERE firebase_uid = $1',
        [firebaseUid]
      );
    } catch (dbErr) {
      console.error("❌ Database Error during auth:", dbErr.message);
      return res.status(500).json({
        error: 'Internal Database Error',
        details: dbErr.message
      });
    }

    if (dbResult.rowCount === 0) {
      console.warn(`⚠️ Blocked: UID ${firebaseUid} not synced and tried to access ${req.path}`);
      return res.status(403).json({
        error: 'User not registered. Please sync account first.'
      });
    }

    // 5. Attach DB-backed identity
    req.user.id = dbResult.rows[0].id;
    req.user.role = dbResult.rows[0].role;

    next();
  } catch (error) {
    console.error('❌ Auth Verification Failed:', error.message);
    return res.status(403).json({
      error: 'Unauthorized',
      details: error.message
    });
  }
};

module.exports = { verifyToken };
