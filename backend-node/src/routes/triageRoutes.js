const express = require('express');
const router = express.Router();
// ⚠️ Ensure authMiddleware is imported with { } if it exports an object, or without if it's a single function.
// Based on your last setup, it was exporting an object: module.exports = { verifyToken }
const { verifyToken } = require('../middleware/authMiddleware');
const { requireDoctor } = require('../middleware/roleMiddleware');

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
// Africa's Talking callback. If AT_CALLBACK_SECRET is set, the callback URL must
// include ?token=<secret>, so random POSTs can't inject fake patient reports.
const crypto = require('crypto');
const ussdTokenValid = (req, res, next) => {
    const expected = process.env.AT_CALLBACK_SECRET;
    if (!expected) return next();
    const provided = String(req.query.token || '');
    const ok = provided.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!ok) return res.status(403).type('text/plain').send('END Unauthorized');
    next();
};
router.post('/ussd', ussdTokenValid, handleUSSD);

// --- PROTECTED ROUTES (Require Token) ---
router.post('/', verifyToken, submitTriageReport);   // nurses, doctors, admins
router.get('/stats', verifyToken, getTriageStats);    // aggregate counts only
router.get('/queue', verifyToken, requireDoctor, getQueue);
router.put('/:id/resolve', verifyToken, requireDoctor, resolveTriage);

module.exports = router;