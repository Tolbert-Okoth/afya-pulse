const axios = require('axios');
const db = require('../config/db');

// 🛡️ FIX: Use environment variable for AI Service URL (Critical for Render/Vercel)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000/predict';
const AI_SECRET_KEY = process.env.SERVICE_SECRET_KEY || "default_insecure_key"; 

// @desc    Submit a new Health Report
// @route   POST /api/triage
const submitTriageReport = async (req, res) => {
  try {
    const { symptoms, location, age, gender, phone, history } = req.body; 
    const doctorId = req.user ? req.user.id : null; 

    if (!symptoms) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. ASK THE PYTHON AI BRAIN
    let rawAiOutput = null;
    let triageCategory = 'RED'; // Safety default
    
    let aiAnalysis = { 
      reasoning: 'AI service unavailable – defaulting to RED',
      possible_conditions: [],
      advice: 'Seek immediate medical attention.',
      follow_up_questions: [] 
    };

    try {
      const response = await axios.post(AI_SERVICE_URL, {
        symptoms, age, gender, history: history || [] 
      }, {
        headers: { 'X-Service-Key': AI_SECRET_KEY },
        timeout: 8000 // Reduced to 8s to stay within USSD gateway limits
      });

      if (response.data && response.data.output) {
        rawAiOutput = response.data.output;
        const outputUpper = rawAiOutput.toUpperCase();

        // Regex Parsing Logic
        const extract = (regex) => {
          const match = rawAiOutput.match(regex);
          return match && match[1] ? match[1].trim() : null;
        };

        triageCategory = outputUpper.includes('RISK_LEVEL: GREEN') ? 'GREEN' : 
                         outputUpper.includes('RISK_LEVEL: YELLOW') ? 'YELLOW' : 'RED';

        aiAnalysis = {
          raw_output: rawAiOutput,
          reasoning: extract(/RATIONALE:\s*(.*)/i) || "Analysis Complete",
          follow_up_questions: extract(/QUESTION_ASKED:\s*(.*)/i)?.split(',').filter(q => q.toLowerCase() !== 'none') || [],
          possible_conditions: extract(/POTENTIAL_CAUSES:\s*(.*)/i)?.split(',').map(c => c.trim()) || [],
          advice: extract(/NEXT_ACTION:\s*(.*)/i) || "Consult a doctor."
        };
      }
    } catch (aiError) {
      console.error('⚠️ AI Service unreachable. Using safety fallback.');
    }

    // 2. SAVE TO DB
    const needsReview = triageCategory !== 'GREEN';
    const enrichedSymptoms = `[Age: ${age || '?'}, Sex: ${gender || '?'}] ${symptoms}`;

    const query = `
      INSERT INTO health_reports 
      (symptoms, triage_category, location, is_flagged_for_review, doctor_id, patient_phone, raw_ai_response)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    
    const dbResult = await db.query(query, [
      enrichedSymptoms, triageCategory, location, needsReview, doctorId, phone, JSON.stringify(aiAnalysis)
    ]);
    const newPatient = dbResult.rows[0];

    // 3. 🚨 CLUSTER DETECTION (Outbreak Alert Logic)
    if (triageCategory === 'RED') {
      const clusterQuery = `
        SELECT COUNT(*) FROM health_reports 
        WHERE location = $1 AND triage_category = 'RED' 
        AND created_at >= NOW() - INTERVAL '1 hour';
      `;
      const clusterResult = await db.query(clusterQuery, [location]);
      if (parseInt(clusterResult.rows[0].count) >= 3) {
        req.io.emit('OUTBREAK_ALERT', { location, count: clusterResult.rows[0].count });
      }
    }

    // 4. BROADCAST
    if (req.io) {
      req.io.emit('queue_update', { type: 'ADD', patient: { ...newPatient, ai_analysis: aiAnalysis } });
    }

    res.status(201).json({ data: newPatient, ai_analysis: aiAnalysis });

  } catch (error) {
    console.error('Controller Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ... keep getTriageStats and getQueue as they were, but ensure they use error handling ...

const resolveTriage = async (req, res) => {
    try {
        const { id } = req.params;
        const { doctor_final_category } = req.body; 

        const isTreated = doctor_final_category === 'TREATED';
        const query = isTreated ? 
            `UPDATE health_reports SET is_resolved = TRUE, is_flagged_for_review = FALSE WHERE report_id = $1 RETURNING *;` :
            `UPDATE health_reports SET triage_category = $1, is_flagged_for_review = FALSE WHERE report_id = $2 RETURNING *;`;
        
        const values = isTreated ? [id] : [doctor_final_category, id];
        const result = await db.query(query, values);
        
        if (result.rows.length === 0) return res.status(404).json({ error: "Report not found" });

        if (req.io) {
            req.io.emit('queue_update', { 
                type: isTreated ? 'REMOVE' : 'UPDATE', 
                id: result.rows[0].report_id,
                patient: result.rows[0]
            });
        }

        res.json({ message: 'Resolved', data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Error resolving case' });
    }
};

module.exports = { submitTriageReport, getTriageStats, resolveTriage, getQueue };