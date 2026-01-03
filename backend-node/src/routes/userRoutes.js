const express = require('express');
const router = express.Router();
const { syncUser } = require('../controllers/userController');

// 👇 KEEP { } if your authMiddleware exports an object (which is standard)
const { verifyToken } = require('../middleware/authMiddleware'); 

// This route is protected. You must have a valid Firebase token to hit it.
// POST /api/users/sync
router.post('/sync', verifyToken, syncUser);

module.exports = router;