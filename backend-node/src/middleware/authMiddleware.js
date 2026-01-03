const admin = require('../config/firebaseAdmin');
const pool = require('../config/db');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(403).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const firebaseUid = decodedToken.uid;

    // 1. Check if user exists in Postgres
    const query = 'SELECT id, email, role FROM users WHERE firebase_uid = $1';
    const result = await pool.query(query, [firebaseUid]);

    // 2. Prepare the user object
    req.user = {
      uid: firebaseUid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
      phone_number: decodedToken.phone_number,
      // If DB record exists, add these. If not, they are undefined (which is fine for /sync)
      id: result.rows.length > 0 ? result.rows[0].id : null,
      role: result.rows.length > 0 ? result.rows[0].role : null
    };

    // 3. ⚠️ CRITICAL FIX: Do NOT block if user is missing. 
    // Let the controller handle it (Sync needs to run for missing users).
    next();

  } catch (error) {
    console.error('❌ Auth Verification Failed:', error.message);
    return res.status(403).json({ error: 'Unauthorized', details: error.message });
  }
};

// Export as an object to match your routes: const { verifyToken } = ...
module.exports = { verifyToken };