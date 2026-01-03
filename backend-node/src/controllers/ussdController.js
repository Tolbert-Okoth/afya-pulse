const axios = require('axios');
const db = require('../config/db');
const AfricasTalking = require('africastalking');

// 1. Configure Africa's Talking
const africastalking = AfricasTalking({
    apiKey: process.env.AT_API_KEY || 'sandbox',
    username: process.env.AT_USERNAME || 'sandbox'
});
const sms = africastalking.SMS;

// 🛡️ FIX: Use Production AI URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000/predict';
const AI_SECRET_KEY = process.env.SERVICE_SECRET_KEY || "default_insecure_key"; 

// 🌍 TRANSLATION DICTIONARY
const CONTENT = {
    en: {
        welcome: "CON Welcome to Afya-Pulse\n1. Report Symptoms\n2. Emergency",
        location: "CON Enter your County (e.g. Nairobi):",
        age: "CON Enter your Age (e.g. 30):",
        gender: "CON Select Gender:\n1. Male\n2. Female",
        symptoms: "CON Describe your symptoms (e.g. Fever, Headache):",
        emergency: "END Emergency Services:\nAmbulance: 999\nPolice: 911",
        end_red: "END CRITICAL: Go to the nearest hospital immediately. Check your SMS.",
        end_yellow: "END ADVICE: Please visit a clinic soon. Check your SMS.",
        sms_red: "CRITICAL (Afya-Pulse): Your symptoms indicate a serious condition. Visit a hospital immediately. ID:",
        sms_yellow: "ADVICE (Afya-Pulse): Please see a doctor for evaluation. ID:"
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
    const { sessionId, phoneNumber, text = '' } = req.body;
    let response = '';

    // Split text by * and filter out empty strings to prevent state jumping
    const inputs = text.split('*').filter(x => x !== '');
    
    // --- STEP 0: LANGUAGE SELECTION ---
    if (inputs.length === 0) {
        response = `CON Chagua Lugha / Select Language:\n1. English\n2. Kiswahili`;
    } else {
        const langCode = inputs[0] === '2' ? 'sw' : 'en';
        const lang = CONTENT[langCode];

        // --- USSD STATE MACHINE ---
        switch (inputs.length) {
            case 1: // Welcome Menu
                response = lang.welcome;
                break;
            case 2: // Sub-menu (Report vs Emergency)
                if (inputs[1] === '2') response = lang.emergency;
                else response = lang.location;
                break;
            case 3:
                response = lang.age;
                break;
            case 4:
                response = lang.gender;
                break;
            case 5:
                response = lang.symptoms;
                break;
            case 6:
                // --- FINAL PROCESSING ---
                const [langChoice, menuChoice, location, age, genderSelect, symptoms] = inputs;
                const gender = genderSelect === '1' ? 'Male' : 'Female';
                
                let triageCategory = 'YELLOW'; // Safe default
                let rawAiOutput = "AI Timeout/Fallback";

                try {
                    const aiRes = await axios.post(AI_SERVICE_URL, {
                        symptoms, age, gender, history: []
                    }, { 
                        headers: { 'X-Service-Key': AI_SECRET_KEY },
                        timeout: 7000 // Tightened to 7s for USSD stability
                    });

                    if (aiRes.data?.output) {
                        rawAiOutput = aiRes.data.output;
                        const out = rawAiOutput.toUpperCase();
                        triageCategory = out.includes('RISK_LEVEL: RED') ? 'RED' : 
                                         out.includes('RISK_LEVEL: GREEN') ? 'GREEN' : 'YELLOW';
                    }
                } catch (err) {
                    console.error("⚠️ AI USSD Fallback used");
                }

                // Database Persistence
                try {
                    const enriched = `[USSD-${langCode.toUpperCase()}] [Age:${age}, Sex:${gender}] ${symptoms}`;
                    const dbRes = await db.query(
                        `INSERT INTO health_reports (symptoms, triage_category, location, is_flagged_for_review, patient_phone, raw_ai_response)
                         VALUES ($1, $2, $3, $4, $5, $6) RETURNING report_id`,
                        [enriched, triageCategory, location, triageCategory !== 'GREEN', phoneNumber, JSON.stringify({ raw_output: rawAiOutput })]
                    );
                    
                    const reportId = dbRes.rows[0].report_id;

                    // Real-time Dashboard Update
                    if (req.io) {
                        req.io.emit('queue_update', { 
                            type: 'ADD', 
                            patient: { report_id: reportId, symptoms: enriched, triage_category: triageCategory, location, patient_phone: phoneNumber } 
                        });
                    }

                    // SMS Delivery
                    const smsText = triageCategory === 'RED' ? lang.sms_red : lang.sms_yellow;
                    sms.send({ to: phoneNumber, message: `${smsText} #${reportId}` }).catch(e => console.error("SMS Error", e));

                    response = triageCategory === 'RED' ? lang.end_red : lang.end_yellow;
                } catch (dbErr) {
                    response = "END System busy. Please try again.";
                }
                break;
            default:
                response = "END Invalid input.";
        }
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
};

module.exports = { handleUSSD };