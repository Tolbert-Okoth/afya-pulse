const db = require('../config/db');

// @desc    Sync Firebase User with Postgres DB
// @route   POST /api/users/sync
const syncUser = async (req, res) => {
  // 1. Extract data from req.user (populated by verifyToken middleware)
  const { uid, email, name, picture, phone_number } = req.user; 

  if (!email) {
    return res.status(400).json({ error: 'Email is required for synchronization' });
  }

  try {
    // 2. Optimized UPSERT Logic
    // FIX: Removed 'name' and 'photo_url' to avoid "Column Does Not Exist" errors.
    // We use firebase_uid, email, and role as the core columns.
    const query = `
      INSERT INTO users (firebase_uid, email, role, last_login)
      VALUES ($1, $2, 'nurse', NOW())
      ON CONFLICT (email) 
      DO UPDATE SET 
        firebase_uid = EXCLUDED.firebase_uid,
        last_login = NOW()
      RETURNING id, firebase_uid, email, role;
    `;

    const values = [
      uid, 
      email.toLowerCase() // Ensure email consistency
    ];

    const result = await db.query(query, values);
    const user = result.rows[0];

    // 3. Log the role for debugging
    console.log(`👤 Sync Success: ${user.email} assigned role [${user.role}]`);
    
    return res.status(200).json({
      message: "User synced successfully",
      user: user
    });

  } catch (error) {
    console.error('❌ Sync Error Details:', {
      message: error.message,
      detail: error.detail,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Database Sync Failed',
      details: error.message 
    });
  }
};

module.exports = { syncUser };