const db = require('../config/db');

// @desc    Sync Firebase User with Postgres DB
// @route   POST /api/users/sync
const syncUser = async (req, res) => {
  // 1. Destructure correctly from Firebase Middleware
  //    (Firebase Admin SDK returns 'name' and 'picture', NOT 'displayName')
  const { uid, email, name, picture, phone_number } = req.user; 

  try {
    // 2. UPSERT Logic (Insert if new, Update if exists)
    //    We default role to 'patient' only on insert.
    const query = `
      INSERT INTO users (firebase_uid, email, name, photo_url, phone_number, role)
      VALUES ($1, $2, $3, $4, $5, 'patient')
      ON CONFLICT (email) 
      DO UPDATE SET 
        firebase_uid = EXCLUDED.firebase_uid,
        name = COALESCE(users.name, EXCLUDED.name),
        photo_url = COALESCE(users.photo_url, EXCLUDED.photo_url),
        last_login = NOW()
      RETURNING *;
    `;

    const values = [uid, email, name || 'Anonymous', picture, phone_number];

    const result = await db.query(query, values);
    const user = result.rows[0];

    console.log(`👤 Sync Success: ${user.email} (${user.role})`);
    
    // 3. Return user data so frontend knows if they are 'doctor' or 'patient'
    return res.status(200).json(user);

  } catch (error) {
    console.error('❌ Sync Error:', error.message);
    res.status(500).json({ error: 'Database Sync Failed' });
  }
};

module.exports = { syncUser };