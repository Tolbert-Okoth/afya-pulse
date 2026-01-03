const db = require('../config/db');

const requireDoctor = async (req, res, next) => {
  try {
    // 1. OPTIMIZED PATH: If authMiddleware already fetched the role
    if (req.user && req.user.role) {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ error: 'Access Denied: Doctors Only' });
      }
      // User is authorized
      return next(); 
    }

    // 2. FALLBACK PATH: If req.user only has Firebase data (uid)
    const { uid } = req.user; 

    // ⚠️ FIX 1: Change 'user_id' to 'id' (This matches your Postgres Schema)
    const result = await db.query('SELECT id, role FROM users WHERE firebase_uid = $1', [uid]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in records' });
    }

    const userData = result.rows[0];

    // ⚠️ FIX 2: Attach as 'req.user.id' to match what authMiddleware does
    // If you use 'req.user.user_id', your controllers looking for 'req.user.id' will break.
    req.user.id = userData.id; 
    req.user.role = userData.role;

    // 4. Verify Role
    if (userData.role !== 'doctor') {
      console.warn(`⛔ API Block: User ${uid} tried to access Doctor API`);
      return res.status(403).json({ error: 'Access Denied: Doctors Only' });
    }

    // Access Granted
    next();

  } catch (error) {
    console.error("Role Check Error:", error);
    res.status(500).json({ error: 'Server Authorization Error' });
  }
};

module.exports = { requireDoctor };