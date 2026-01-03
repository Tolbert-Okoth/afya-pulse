const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); 

const { 
    submitTriageReport, 
    getTriageStats, 
    resolveTriage, 
    getQueue 
} = require('../controllers/triageController');

// 🆕 Import the USSD Controller
const { handleUSSD } = require('../controllers/ussdController');

// --- 🌍 PUBLIC ROUTE (USSD) ---
// This comes from Africa's Talking Gateway, so NO authMiddleware here.
// Full URL: POST /api/triage/ussd
router.post('/ussd', handleUSSD);


// --- 🔒 PROTECTED DOCTOR ROUTES ---

// 1. Submit Report (Nurse Kiosk / Doctor Input)
router.post('/', authMiddleware, submitTriageReport);

// 2. Get Stats (Filters by Doctor ID)
router.get('/stats', authMiddleware, getTriageStats);

// 3. Get Queue (Filters by Doctor ID)
router.get('/queue', authMiddleware, getQueue);

// 4. Resolve/Treat Patient (Updates specific record)
router.put('/:id/resolve', authMiddleware, resolveTriage);

module.exports = router;