const db = require('../config/db');

const syncUser = async (req, res) => {
  const { uid, email, displayName, photoURL } = req.user; // From Auth Middleware

  try {
    // 1. Check if user exists
    const userCheck = await db.query('SELECT * FROM users WHERE firebase_uid = $1', [uid]);

    if (userCheck.rows.length > 0) {
      // USER EXISTS: Update login time and return their data (including ROLE)
      const existingUser = userCheck.rows[0];
      await db.query('UPDATE users SET last_login = NOW() WHERE firebase_uid = $1', [uid]);
      
      console.log(`👤 Sync: Existing User (${existingUser.role})`);
      return res.status(200).json(existingUser); // <--- Returns { role: 'doctor', ... }
    } else {
      // NEW USER: Create them (Default role is 'patient')
      const newUser = await db.query(
        `INSERT INTO users (firebase_uid, email, display_name, photo_url, role) 
         VALUES ($1, $2, $3, $4, 'patient') 
         RETURNING *`,
        [uid, email, displayName, photoURL]
      );
      
      console.log(`👤 Sync: New User Created`);
      return res.status(201).json(newUser.rows[0]);
    }
  } catch (error) {
    console.error('❌ Sync Error:', error.message);
    res.status(500).json({ error: 'Database Sync Failed' });
  }
};

module.exports = { syncUser };