const db = require('../config/db');

// @desc    Sync Firebase User with Postgres DB
// @route   POST /api/users/sync
const syncUser = async (req, res) => {
  // Extract from Firebase token (verifyToken middleware)
  const { uid, email, name, picture, phone_number } = req.user;

  // 🔐 UID is mandatory, email is optional
  if (!uid) {
    return res.status(400).json({ error: 'Firebase UID is required' });
  }

  try {
    const query = `
      INSERT INTO users (
        firebase_uid,
        email,
        role,
        display_name,
        photo_url,
        phone_number,
        last_login
      )
      VALUES ($1, $2, 'nurse', $3, $4, $5, NOW())
      ON CONFLICT (firebase_uid)
      DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        photo_url = EXCLUDED.photo_url,
        phone_number = EXCLUDED.phone_number,
        last_login = NOW()
      RETURNING id, firebase_uid, email, role;
    `;

    const values = [
      uid,
      email ? email.toLowerCase() : null,
      name || null,
      picture || null,
      phone_number || null
    ];

    const result = await db.query(query, values);
    const user = result.rows[0];

    console.log(`👤 Sync Success: UID=${user.firebase_uid}, role=[${user.role}]`);

    return res.status(200).json({
      message: 'User synced successfully',
      user
    });

  } catch (error) {
    console.error('❌ Sync Error Details:', {
      message: error.message,
      detail: error.detail,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Database Sync Failed',
      details: error.message
    });
  }
};

module.exports = { syncUser };
