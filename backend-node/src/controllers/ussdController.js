const axios = require('axios');
const db = require('../config/db');
const AfricasTalking = require('africastalking');

// 1. Configure Africa's Talking (SMS)
// NOTE: For now we use sandbox credentials.
const africastalking = AfricasTalking({
    apiKey: process.env.AT_API_KEY || 'sandbox', // Use 'sandbox' for testing
    username: process.env.AT_USERNAME || 'sandbox'
});
const sms = africastalking.SMS;

// 2. AI Configuration
const AI_SERVICE_URL = 'http://localhost:5000/predict';
const AI_SECRET_KEY = process.env.SERVICE_SECRET_KEY || "default_insecure_key"; 

// 3. 🌍 TRANSLATION DICTIONARY
const CONTENT = {
    en: {
        welcome: "CON Welcome to Afya-Pulse\n1. Report Symptoms\n2. Emergency",
        location: "CON Enter your County (e.g. Nairobi):",
        age: "CON Enter your Age (e.g. 30):",
        gender: "CON Select Gender:\n1. Male\n2. Female",
        symptoms: "CON Describe your symptoms (e.g. Fever, Headache):",
        emergency: "END Emergency Services:\nAmbulance: 999\nPolice: 911",
        end_red: "END CRITICAL: Go to the nearest hospital immediately. We have sent you an SMS.",
        end_yellow: "END ADVICE: Please visit a clinic soon. We have sent you an SMS.",
        sms_red: "CRITICAL (Afya-Pulse): Your symptoms indicate a serious condition. Please visit a hospital immediately. ID:",
        sms_yellow: "ADVICE (Afya-Pulse): Based on your report, please see a doctor. ID:"
    },
    sw: {
        welcome: "CON Karibu Afya-Pulse\n1. Ripoti Dalili\n2. Dharura",
        location: "CON Weka Kaunti yako (mfano: Nairobi):",
        age: "CON Weka Umri wako (mfano: 30):",
        gender: "CON Chagua Jinsia:\n1. Mwanaume\n2. Mwanamke",
        symptoms: "CON Elezea dalili zako (mfano: Homa, Kichwa):",
        emergency: "END Huduma za Dharura:\nAmbulance: 999\nPolisi: 911",
        end_red: "END HATARI: Nenda hospitali mara moja. Tumekutumia SMS.",
        end_yellow: "END USHAURI: Tafadhali nenda kliniki. Tumekutumia SMS.",
        sms_red: "HATARI (Afya-Pulse): Dalili zako ni mbaya. Nenda hospitali mara moja. ID:",
        sms_yellow: "USHAURI (Afya-Pulse): Tafadhali muone daktari kwa uchunguzi zaidi. ID:"
    }
};

const handleUSSD = async (req, res) => {
    // Safety check for empty body
    const body = req.body || {};
    const { sessionId, serviceCode, phoneNumber, text = '' } = body;

    let response = '';

    // Convert text to string and split
    const safeText = text ? text.toString() : '';
    const inputs = safeText.split('*');
    
    // --- 🌍 STEP 0: LANGUAGE SELECTION (First Screen) ---
    // User sees: 1. English 2. Kiswahili
    if (safeText === '') {
        response = `CON Chagua Lugha / Select Language:
        1. English
        2. Kiswahili`;
        res.set('Content-Type', 'text/plain');
        return res.send(response);
    }

    // Determine Language based on first input
    // inputs[0] will be '1' (English) or '2' (Swahili)
    const langCode = inputs[0] === '2' ? 'sw' : 'en';
    const lang = CONTENT[langCode];

    // --- STEP 1: WELCOME MENU ---
    // Logic: inputs=['1'] -> User selected English. Now show Welcome.
    if (inputs.length === 1) {
        response = lang.welcome;
    }

    // --- STEP 2: LOCATION ---
    // Logic: inputs=['1', '1'] -> English -> Report Symptoms
    else if (inputs.length === 2 && inputs[1] === '1') {
        response = lang.location;
    }

    // --- STEP 3: AGE ---
    else if (inputs.length === 3 && inputs[1] === '1') {
        response = lang.age;
    }

    // --- STEP 4: GENDER ---
    else if (inputs.length === 4 && inputs[1] === '1') {
        response = lang.gender;
    }

    // --- STEP 5: SYMPTOMS ---
    else if (inputs.length === 5 && inputs[1] === '1') {
        response = lang.symptoms;
    }

    // --- FINAL STEP: PROCESS & SMS ---
    else if (inputs.length === 6 && inputs[1] === '1') {
        const location = inputs[2];
        const age = inputs[3];
        const genderSelection = inputs[4]; 
        const symptoms = inputs[5];

        const gender = genderSelection === '1' ? 'Male' : 'Female';

        // 1. AI Analysis with DEFAULT FALLBACK to prevent NULL DB Errors
        let triageCategory = 'YELLOW';
        let rawAiOutput = "AI Unavailable";

        try {
             const aiRes = await axios.post(AI_SERVICE_URL, {
                symptoms: symptoms,
                age: age,
                gender: gender,
                history: [] // USSD has no conversational history
             }, { headers: { 'X-Service-Key': AI_SECRET_KEY } });

             if (aiRes.data && aiRes.data.output) {
                rawAiOutput = aiRes.data.output;
                const outputUpper = rawAiOutput.toUpperCase();

                // 🧠 PARSING LOGIC: Extract RISK_LEVEL from text block
                if (outputUpper.includes('RISK_LEVEL: RED') || outputUpper.includes('RISK LEVEL: RED')) {
                    triageCategory = 'RED';
                } else if (outputUpper.includes('RISK_LEVEL: GREEN') || outputUpper.includes('RISK LEVEL: GREEN')) {
                    triageCategory = 'GREEN';
                } else {
                    triageCategory = 'YELLOW'; // Default for intermediate cases
                }
             }
        } catch (err) {
            console.error("AI Failed (USSD):", err.message);
            // triageCategory remains 'YELLOW' as fallback
        }

        // 2. Database Save
        try {
            const enrichedSymptoms = `[USSD-${langCode.toUpperCase()}] [Age:${age}, Sex:${gender}] ${symptoms}`;
            let needsReview = triageCategory === 'RED';

            const query = `
                INSERT INTO health_reports 
                (symptoms, triage_category, location, is_flagged_for_review, patient_phone, raw_ai_response)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING report_id;
            `;
            // ⚠️ FIX: Pass 'triageCategory' string directly, not the whole AI object
            const dbRes = await db.query(query, [
                enrichedSymptoms, 
                triageCategory, 
                location, 
                needsReview, 
                phoneNumber,
                JSON.stringify({ raw_output: rawAiOutput }) // Save raw output for debugging
            ]);
            
            const newReport = dbRes.rows[0];

            // 3. Real-time Update
            if (req.io) {
                req.io.emit('queue_update', { 
                    type: 'ADD', 
                    patient: { 
                        report_id: newReport.report_id,
                        symptoms: enrichedSymptoms,
                        triage_category: triageCategory,
                        location: location,
                        patient_phone: phoneNumber,
                        ai_analysis: { raw_output: rawAiOutput }
                    } 
                });
            }

            // 4. 📨 SEND SMS
            const smsMessage = triageCategory === 'RED' 
                ? `${lang.sms_red} #${newReport.report_id}` 
                : `${lang.sms_yellow} #${newReport.report_id}`;

            try {
                // Africa's Talking SMS Send
                await sms.send({
                    to: phoneNumber,
                    message: smsMessage
                });
                console.log("📨 SMS Sent to", phoneNumber);
            } catch (smsError) {
                console.error("SMS Failed:", smsError);
            }

            // 5. Final Screen Response
            response = triageCategory === 'RED' ? lang.end_red : lang.end_yellow;

        } catch (dbError) {
            console.error("DB Error:", dbError);
            response = `END System Error.`;
        }
    }

    // --- EMERGENCY OPTION ---
    // If inputs[1] is '2' -> Emergency
    else if (inputs.length === 2 && inputs[1] === '2') {
        response = lang.emergency;
    }
    
    else {
        response = `END Invalid input / Chaguo si sahihi`;
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
};

module.exports = { handleUSSD };