const admin = require('../config/firebaseAdmin');
const pool = require('../config/db');

/**
 * verifyToken
 * 1. Validates the Firebase ID token
 * 2. Attaches uid, email and email_verified
 * 3. Lets only POST /api/users/sync through without a database record
 * 4. Otherwise requires a synced user and attaches their id and role
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(authHeader.slice('Bearer '.length));
  } catch (error) {
    console.warn('Auth: token verification failed:', error.code || error.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = {
    uid: decodedToken.uid,
    email: decodedToken.email || null,
    email_verified: decodedToken.email_verified === true,
    name: decodedToken.name || null,
    picture: decodedToken.picture || null,
  };

  // Exact match only: a query string or similar path must not skip the database check
  const isSyncRoute = req.method === 'POST' && `${req.baseUrl}${req.path}` === '/api/users/sync';
  if (isSyncRoute) return next();

  try {
    const dbResult = await pool.query('SELECT id, role FROM users WHERE firebase_uid = $1', [decodedToken.uid]);
    if (dbResult.rowCount === 0) {
      return res.status(403).json({ error: 'User not registered. Please sync account first.' });
    }
    req.user.id = dbResult.rows[0].id;
    req.user.role = dbResult.rows[0].role;
    next();
  } catch (dbErr) {
    console.error('Database error during auth:', dbErr.message);
    return res.status(500).json({ error: 'Internal error' });
  }
};

module.exports = { verifyToken };
