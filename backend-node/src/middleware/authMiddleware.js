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

    // 👇 FIX 1: Query for 'id', not 'user_id'
    const query = 'SELECT id, email, role FROM users WHERE firebase_uid = $1';
    const result = await pool.query(query, [firebaseUid]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User record not found in system.' });
    }

    // 👇 FIX 2: Save it as 'id' in the request object
    req.user = {
      ...decodedToken,
      id: result.rows[0].id, // Matches your DB column 'id'
      role: result.rows[0].role
    };

    next();
  } catch (error) {
    console.error('❌ Auth Verification Failed:', error.message);
    return res.status(403).json({ error: 'Unauthorized', details: error.message });
  }
};

module.exports = verifyToken;