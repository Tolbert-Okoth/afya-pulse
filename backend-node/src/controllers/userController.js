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
    // We conflict on 'email' as the primary identity anchor.
    // We update the firebase_uid to ensure it stays in sync if the user re-registers.
    const query = `
      INSERT INTO users (firebase_uid, email, name, photo_url, phone_number, role, last_login)
      VALUES ($1, $2, $3, $4, $5, 'nurse', NOW())
      ON CONFLICT (email) 
      DO UPDATE SET 
        firebase_uid = EXCLUDED.firebase_uid,
        name = EXCLUDED.name,
        photo_url = EXCLUDED.photo_url,
        phone_number = COALESCE(users.phone_number, EXCLUDED.phone_number),
        last_login = NOW()
      RETURNING id, firebase_uid, email, name, photo_url, role;
    `;

    const values = [
      uid, 
      email.toLowerCase(), // Ensure email consistency
      name || 'Anonymous User', 
      picture || null, 
      phone_number || null
    ];

    const result = await db.query(query, values);
    const user = result.rows[0];

    // 3. Log the role for debugging (Critical for identifying why a user might see 403s later)
    console.log(`👤 Sync Success: ${user.email} assigned role [${user.role}]`);
    
    return res.status(200).json({
      message: "User synced successfully",
      user: user
    });

  } catch (error) {
    console.error('❌ Sync Error Details:', {
      message: error.message,
      detail: error.detail, // Postgres specific error detail (e.g., Key already exists)
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Database Sync Failed',
      details: error.message 
    });
  }
};

module.exports = { syncUser };