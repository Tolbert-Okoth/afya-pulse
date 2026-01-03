const express = require('express');
const router = express.Router();
// ⚠️ Ensure authMiddleware is imported with { } if it exports an object, or without if it's a single function.
// Based on your last setup, it was exporting an object: module.exports = { verifyToken }
const { verifyToken } = require('../middleware/authMiddleware'); 

const { 
    submitTriageReport, 
    getTriageStats, 
    resolveTriage, 
    getQueue 
} = require('../controllers/triageController');

// ⚠️ IMPORT CHECK: This must match the file name in src/controllers/ exactly
const ussdController = require('../controllers/ussdController');

// Safety Check: Did we get the function?
let handleUSSD = ussdController.handleUSSD;
if (!handleUSSD) {
    console.error("❌ CRITICAL ERROR: 'handleUSSD' is missing! Check src/controllers/ussdController.js exports.");
    // Fallback to prevent crash
    handleUSSD = (req, res) => res.status(500).send("USSD Misconfigured");
}

// --- PUBLIC ROUTE (No Auth) ---
router.post('/ussd', handleUSSD);

// --- PROTECTED ROUTES (Require Token) ---
router.post('/', verifyToken, submitTriageReport);
router.get('/stats', verifyToken, getTriageStats);
router.get('/queue', verifyToken, getQueue);
router.put('/:id/resolve', verifyToken, resolveTriage);

module.exports = router;