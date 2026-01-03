const express = require('express');
const router = express.Router();
const { syncUser } = require('../controllers/userController');

// 👇 FIX: Remove { } because authMiddleware exports the function directly now
const verifyToken = require('../middleware/authMiddleware'); 

// This route is protected. You must have a valid Firebase token to hit it.
router.post('/sync', verifyToken, syncUser);

module.exports = router;