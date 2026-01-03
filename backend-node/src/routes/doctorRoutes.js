const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const authMiddleware = require('../middleware/auth'); // Middleware to verify JWT

// The middleware adds the logged-in user's info to 'req.user'
router.get('/my-appointments', authMiddleware, doctorController.getMyAppointments);

module.exports = router;