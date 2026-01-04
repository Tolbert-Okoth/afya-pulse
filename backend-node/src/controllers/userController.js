const db = require('../config/db');

// @desc    Sync Firebase User with Postgres DB
// @route   POST /api/users/sync
const syncUser = async (req, res) => {
  const { uid, email, name, picture, phone_number } = req.user;

  if (!uid || !email) {
    return res.status(400).json({ error: 'UID and Email are required for sync' });
  }

  try {
    // 💡 FIX: We switch the ON CONFLICT target to (email) 
    // because that is the constraint being violated in your logs.
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
      ON CONFLICT (email)
      DO UPDATE SET
        firebase_uid = EXCLUDED.firebase_uid,
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
        last_login = NOW()
      RETURNING id, firebase_uid, email, role;
    `;

    const values = [
      uid,
      email.toLowerCase(),
      name || null,
      picture || null,
      phone_number || null
    ];

    const result = await db.query(query, values);
    const user = result.rows[0];

    console.log(`👤 Sync Success: ${user.email} (Role: ${user.role})`);

    return res.status(200).json({
      message: 'User synced successfully',
      user
    });

  } catch (error) {
    console.error('❌ Sync Error Details:', {
      message: error.message,
      detail: error.detail
    });

    return res.status(500).json({
      error: 'Database Sync Failed',
      details: error.message
    });
  }
};

module.exports = { syncUser };