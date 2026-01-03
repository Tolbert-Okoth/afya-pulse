const db = require('../config/db');

const requireDoctor = async (req, res, next) => {
  try {
    // 1. OPTIMIZED PATH: If authMiddleware already fetched the role
    if (req.user && req.user.role) {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ error: 'Access Denied: Doctors Only' });
      }
      // User is authorized and user_id is already in req.user
      return next(); 
    }

    // 2. FALLBACK PATH: If req.user only has Firebase data (uid)
    // We must fetch the 'user_id' and 'role' from Postgres now.
    const { uid } = req.user; 

    const result = await db.query('SELECT user_id, role FROM users WHERE firebase_uid = $1', [uid]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in records' });
    }

    const userData = result.rows[0];

    // 3. CRITICAL: Attach the SQL ID to the request object
    // Your controllers (getQueue, submitReport) depend on this specific line!
    req.user.user_id = userData.user_id; 
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