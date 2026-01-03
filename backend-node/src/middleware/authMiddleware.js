const admin = require('../config/firebaseAdmin');
const pool = require('../config/db');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('⚠️ Auth Warning: Missing or malformed Authorization header');
      return res.status(403).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID Token
    // This will throw an error if the token is expired or invalid
    const decodedToken = await admin.auth().verifyIdToken(token);
    const firebaseUid = decodedToken.uid;

    // 1. Check if user exists in our PostgreSQL database
    const query = 'SELECT id, email, role FROM users WHERE firebase_uid = $1';
    const result = await pool.query(query, [firebaseUid]);

    // 2. Prepare the user object for the next middleware/controller
    req.user = {
      uid: firebaseUid,
      email: decodedToken.email,
      name: decodedToken.name || 'Anonymous',
      picture: decodedToken.picture || null,
      phone_number: decodedToken.phone_number || null,
      // If DB record exists, attach the Postgres ID and Role
      id: result.rows.length > 0 ? result.rows[0].id : null,
      role: result.rows.length > 0 ? result.rows[0].role : null
    };

    // 3. Log success for debugging (can be removed in high-traffic production)
    console.log(`👤 Auth: ${req.user.email} verified (DB ID: ${req.user.id || 'NEW USER'})`);

    // ⚠️ IMPORTANT: We call next() even if req.user.id is null.
    // This allows the /api/users/sync route to create the user in the DB.
    next();

  } catch (error) {
    // Enhanced error logging to catch why Render is failing (expired vs. config issue)
    console.error('❌ Auth Verification Failed:', {
      message: error.message,
      code: error.code // Firebase specific error code (e.g., 'auth/id-token-expired')
    });

    return res.status(403).json({ 
      error: 'Unauthorized', 
      details: error.code === 'auth/id-token-expired' ? 'Token Expired' : 'Invalid Token'
    });
  }
};

module.exports = { verifyToken };