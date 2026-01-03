const express = require('express');
const router = express.Router();

// Controllers
const { syncUser } = require('../controllers/userController');

// Middleware
// Standard object destructuring for the export in authMiddleware.js
const { verifyToken } = require('../middleware/authMiddleware'); 

/**
 * @route   POST /api/users/sync
 * @desc    Syncs Firebase authenticated user with PostgreSQL.
 * If the user doesn't exist, it creates a record.
 * If they do exist, it updates their 'last_login'.
 * @access  Private (Requires Firebase ID Token)
 */
router.post('/sync', verifyToken, syncUser);

// Optional: Add a profile fetch route for the dashboard
// router.get('/profile', verifyToken, (req, res) => res.json(req.user));

module.exports = router;