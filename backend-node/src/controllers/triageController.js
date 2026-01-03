const axios = require('axios');
const db = require('../config/db');

// Ensure this matches your Python Port (5000)
const AI_SERVICE_URL = 'http://localhost:5000/predict';
const AI_SECRET_KEY = process.env.SERVICE_SECRET_KEY || "default_insecure_key"; 

// @desc    Submit a new Health Report
// @route   POST /api/triage
const submitTriageReport = async (req, res) => {
  try {
    const { symptoms, location, age, gender, phone, history } = req.body; 
    
    console.log("---------------------------------");
    console.log("Received Phone:", phone); 
    console.log("---------------------------------");

    const doctorId = req.user ? req.user.id : null; 

    if (!symptoms) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. ASK THE PYTHON AI BRAIN
    let rawAiOutput = null;
    let triageCategory = 'RED'; // Default safety net
    
    let aiAnalysis = { 
      reasoning: 'AI service unavailable – defaulting to RED for patient safety',
      possible_conditions: ['Unknown – seek immediate evaluation'],
      advice: 'Seek immediate medical attention. Call 999 immediately.',
      follow_up_questions: [] 
    };

    try {
      const response = await axios.post(AI_SERVICE_URL, {
        symptoms: symptoms,
        age: age || "Unknown",
        gender: gender || "Unknown",
        history: history || [] 
      }, {
        headers: { 'X-Service-Key': AI_SECRET_KEY },
        timeout: 15000 
      });

      if (response.data && response.data.output) {
        rawAiOutput = response.data.output;

        // 🧠 UPDATED PARSING LOGIC (Matches new app.py headers) 🧠
        
        // A. Extract Risk Level (Look for "RISK_LEVEL:" header)
        const outputUpper = rawAiOutput.toUpperCase();
        if (outputUpper.includes('RISK_LEVEL: GREEN')) {
          triageCategory = 'GREEN';
        } else if (outputUpper.includes('RISK_LEVEL: YELLOW')) {
          triageCategory = 'YELLOW';
        } else {
          triageCategory = 'RED'; 
        }

        // B. Extract Follow-Up Question (Look for "QUESTION_ASKED:")
        const questions = [];
        const questionMatch = rawAiOutput.match(/QUESTION_ASKED:\s*(.*)/i);
        
        if (questionMatch && questionMatch[1]) {
            const qText = questionMatch[1].trim();
            if (qText.length > 4 && !qText.toLowerCase().includes('none')) {
                questions.push(qText);
            }
        }

        // C. Extract "Potential Causes" (Look for "POTENTIAL_CAUSES:")
        let conditions = [];
        const conditionsMatch = rawAiOutput.match(/POTENTIAL_CAUSES:\s*(.*)/i);
        if (conditionsMatch && conditionsMatch[1]) {
            conditions = conditionsMatch[1].split(',')
                .map(c => c.trim())
                .filter(c => c.length > 0 && !c.toLowerCase().includes('none'));
        }

        // D. Extract Rationale ("RATIONALE:")
        const reasoningMatch = rawAiOutput.match(/RATIONALE:\s*(.*)/i);
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : "AI Analysis Complete";

        // E. Extract Action ("NEXT_ACTION:")
        const actionMatch = rawAiOutput.match(/NEXT_ACTION:\s*(.*)/i);
        const advice = actionMatch ? actionMatch[1].trim() : "Consult a doctor.";

        // F. Build the Structured Object
        aiAnalysis = { 
           raw_output: rawAiOutput,
           reasoning: reasoning,
           follow_up_questions: questions,
           possible_conditions: conditions, 
           advice: advice
        };
      }
    } catch (aiError) {
      console.error('AI Service Error (fallback to RED):', aiError.message || aiError);
    }

    // 2. HUMAN INTEGRATION LOGIC
    let needsReview = false;
    if (triageCategory === 'YELLOW' || triageCategory === 'RED') {
      needsReview = true;
    }

    // 3. SAVE TO DB
    const enrichedSymptoms = `[Age: ${age || '?'}, Sex: ${gender || '?'}] ${symptoms}`;

    const query = `
      INSERT INTO health_reports 
      (symptoms, triage_category, location, is_flagged_for_review, doctor_id, patient_phone, raw_ai_response)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING report_id, triage_category, is_flagged_for_review, created_at, symptoms, location, doctor_id, patient_phone;
    `;
    
    const values = [
      enrichedSymptoms,
      triageCategory,     
      location,
      needsReview,
      doctorId,
      phone,
      JSON.stringify(aiAnalysis) 
    ];

    const dbResult = await db.query(query, values);
    const newPatient = dbResult.rows[0];

    // 4. BROADCAST TO DOCTORS
    if (req.io) {
      req.io.emit('queue_update', { 
        type: 'ADD', 
        patient: { 
          ...newPatient, 
          ai_analysis: aiAnalysis 
        } 
      });
      console.log(`Emitted New Patient Event (Category: ${triageCategory})`);
    }

    res.status(201).json({
      message: needsReview ? 'Flagged for Review' : 'Triage Complete',
      data: newPatient,
      ai_analysis: aiAnalysis 
    });

  } catch (error) {
    console.error('Controller Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// @desc    Get Stats & Active Doctor Count
// @route   GET /api/triage/stats
const getTriageStats = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const statsQuery = `
      SELECT triage_category, COUNT(*) as count 
      FROM health_reports 
      WHERE (is_resolved = FALSE OR is_resolved IS NULL)
      AND (doctor_id = $1 OR triage_category = 'RED') 
      GROUP BY triage_category;
    `;
    const statsResult = await db.query(statsQuery, [doctorId]);
    const stats = statsResult.rows;

    const doctorCountQuery = `
        SELECT COUNT(*) as active_count 
        FROM users 
        WHERE role = 'doctor';
    `;
    const doctorResult = await db.query(doctorCountQuery);
    const activeDoctors = parseInt(doctorResult.rows[0].active_count) || 1;

    let redCount = 0;
    let totalCount = 0;

    stats.forEach(s => {
      const count = parseInt(s.count);
      totalCount += count;
      if (s.triage_category === 'RED') redCount += count; 
    });

    let systemStatus = 'NORMAL';
    if (redCount >= 3) systemStatus = 'CRITICAL';
    else if (totalCount > 15 || redCount >= 1) systemStatus = 'HIGH';
    else if (totalCount > 5) systemStatus = 'MODERATE';

    res.status(200).json({
      stats: stats,
      system_status: systemStatus,
      active_doctors: activeDoctors 
    });

  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// @desc    Get Queue (My Patients + All Criticals)
// @route   GET /api/triage/queue
const getQueue = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const query = `
      SELECT * FROM health_reports 
      WHERE (is_resolved = FALSE OR is_resolved IS NULL) 
      AND (doctor_id = $1 OR triage_category = 'RED') 
      ORDER BY 
        CASE 
          WHEN triage_category = 'RED' THEN 1 
          WHEN triage_category = 'YELLOW' THEN 2
          WHEN triage_category = 'GREEN' THEN 3
          ELSE 4 
        END,
        created_at DESC;
    `;
    
    const result = await db.query(query, [doctorId]);
    
    // 🛡️ CRASH PROOF PARSING 🛡️
    const parsedRows = result.rows.map(row => {
        let aiData = {};
        try {
            if (typeof row.raw_ai_response === 'string') {
                const trimmed = row.raw_ai_response.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    aiData = JSON.parse(trimmed);
                } else {
                    throw new Error("Not JSON");
                }
            } else if (typeof row.raw_ai_response === 'object' && row.raw_ai_response !== null) {
                aiData = row.raw_ai_response;
            } else {
                aiData = {}; 
            }
        } catch (e) {
            aiData = { 
                raw_output: row.raw_ai_response, 
                reasoning: "Legacy Data",
                advice: "Consult Doctor"
            };
        }
        return { ...row, ai_analysis: aiData };
    });

    res.status(200).json(parsedRows);
  } catch (error) {
    console.error('Queue Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Resolve Flagged Case OR Treat Patient
const resolveTriage = async (req, res) => {
  try {
    const { id } = req.params;
    const { doctor_final_category } = req.body; 

    let query;
    let values;
    let actionType = 'UPDATE'; 

    if (doctor_final_category === 'TREATED') {
        query = `
            UPDATE health_reports 
            SET is_resolved = TRUE, is_flagged_for_review = FALSE
            WHERE report_id = $1
            RETURNING *;
        `;
        values = [id];
        actionType = 'REMOVE';
    } else {
        query = `
            UPDATE health_reports 
            SET triage_category = $1, is_flagged_for_review = FALSE
            WHERE report_id = $2
            RETURNING *;
        `;
        values = [doctor_final_category, id];
    }

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: "Report not found" });
    }

    const updatedPatient = result.rows[0];

    if (req.io) {
        req.io.emit('queue_update', { 
            type: actionType, 
            id: updatedPatient.report_id,
            patient: updatedPatient
        });
        console.log(`Emitted ${actionType} Event for ID ${id}`);
    }

    res.json({ message: 'Resolved', data: updatedPatient });

  } catch (error) {
    console.error("Resolve Error:", error);
    res.status(500).json({ error: 'Error resolving case' });
  }
};

module.exports = { submitTriageReport, getTriageStats, resolveTriage, getQueue };
