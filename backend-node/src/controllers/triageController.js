const axios = require('axios');
const db = require('../config/db');

// 🛡️ CONFIG: Now using the Public URL as the primary connection method
const AI_BASE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';
const AI_SECRET_KEY = process.env.SERVICE_SECRET_KEY || "default_insecure_key"; 

// @desc    Submit or Update a Health Report (Session-Based Logic)
// @route   POST /api/triage
const submitTriageReport = async (req, res) => {
  try {
    const { symptoms, location, age, gender, phone, history } = req.body; 
    const doctorId = req.user ? req.user.id : null; 

    if (!symptoms || !phone) {
      return res.status(400).json({ error: 'Missing symptoms or phone number' });
    }

    // 1. CHECK FOR EXISTING ACTIVE SESSION (Prevents duplication in queue)
    const existingSession = await db.query(
      `SELECT report_id, symptoms FROM health_reports 
       WHERE patient_phone = $1 AND (is_resolved = FALSE OR is_resolved IS NULL) 
       LIMIT 1`,
      [phone]
    );

    // 2. ASK THE PYTHON AI BRAIN
    let rawAiOutput = null;
    let triageCategory = 'RED'; // Safety default
    let aiAnalysis = { 
      reasoning: 'AI service unavailable – defaulting to RED',
      possible_conditions: ['Unknown'],
      advice: 'Seek immediate medical attention.',
      follow_up_questions: [] 
    };

    try {
      const fullAiUrl = `${AI_BASE_URL}/predict`.replace(/([^:]\/)\/+/g, "$1");
      const response = await axios.post(fullAiUrl, {
        symptoms, age: age || "Unknown", gender: gender || "Unknown", history: history || [] 
      }, {
        headers: { 'X-Service-Key': AI_SECRET_KEY },
        timeout: 60000 // 60s for Free Tier cold starts
      });

      if (response.data && response.data.output) {
        rawAiOutput = response.data.output;

        // 🧠 PARSING LOGIC
        const outputUpper = rawAiOutput.toUpperCase();
        if (outputUpper.includes('RISK_LEVEL: GREEN')) triageCategory = 'GREEN';
        else if (outputUpper.includes('RISK_LEVEL: YELLOW')) triageCategory = 'YELLOW';
        else triageCategory = 'RED';

        const questions = [];
        const questionMatch = rawAiOutput.match(/QUESTION_ASKED:\s*(.*)/i);
        if (questionMatch?.[1]) {
            const qText = questionMatch[1].trim();
            if (qText.length > 4 && !qText.toLowerCase().includes('none')) questions.push(qText);
        }

        let conditions = [];
        const conditionsMatch = rawAiOutput.match(/POTENTIAL_CAUSES:\s*(.*)/i);
        if (conditionsMatch?.[1]) {
            conditions = conditionsMatch[1].split(',').map(c => c.trim()).filter(c => c.length > 0 && !c.toLowerCase().includes('none'));
        }

        const reasoningMatch = rawAiOutput.match(/RATIONALE:\s*(.*)/i);
        const actionMatch = rawAiOutput.match(/NEXT_ACTION:\s*(.*)/i);

        aiAnalysis = { 
           raw_output: rawAiOutput,
           reasoning: reasoningMatch ? reasoningMatch[1].trim() : "Analysis Complete",
           follow_up_questions: questions,
           possible_conditions: conditions, 
           advice: actionMatch ? actionMatch[1].trim() : "Consult Doctor"
        };
      }
    } catch (aiError) {
      console.error('❌ AI Handshake Error:', aiError.message);
    }

    // 3. DATABASE UPSERT LOGIC
    const needsReview = (triageCategory === 'YELLOW' || triageCategory === 'RED');
    let finalPatient;
    let actionType = 'ADD';

    if (existingSession.rows.length > 0) {
      // 🔄 UPDATE: Append follow-up symptoms to the original report
      const reportId = existingSession.rows[0].report_id;
      const updatedSymptoms = `${existingSession.rows[0].symptoms} | Follow-up: ${symptoms}`;
      actionType = 'UPDATE';

      const updateQuery = `
        UPDATE health_reports 
        SET symptoms = $1, triage_category = $2, raw_ai_response = $3, is_flagged_for_review = $4
        WHERE report_id = $5
        RETURNING *;
      `;
      const updateResult = await db.query(updateQuery, [updatedSymptoms, triageCategory, JSON.stringify(aiAnalysis), needsReview, reportId]);
      finalPatient = updateResult.rows[0];
    } else {
      // ✨ INSERT: Create brand new patient report
      const enrichedSymptoms = `[Age: ${age || '?'}, Sex: ${gender || '?'}] ${symptoms}`;
      const insertQuery = `
        INSERT INTO health_reports 
        (symptoms, triage_category, location, is_flagged_for_review, doctor_id, patient_phone, raw_ai_response)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const insertResult = await db.query(insertQuery, [enrichedSymptoms, triageCategory, location, needsReview, doctorId, phone, JSON.stringify(aiAnalysis)]);
      finalPatient = insertResult.rows[0];
    }

    // 4. BROADCAST TO DOCTORS
    if (req.io) {
      req.io.emit('queue_update', { 
        type: actionType, 
        id: finalPatient.report_id,
        patient: { ...finalPatient, ai_analysis: aiAnalysis } 
      });
      console.log(`📡 Broadcast ${actionType} for Phone: ${phone}`);
    }

    res.status(201).json({
      message: needsReview ? 'Flagged for Review' : 'Triage Complete',
      data: finalPatient,
      ai_analysis: aiAnalysis 
    });

  } catch (error) {
    console.error('Controller Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// @desc    Get Stats & Active Doctor Count
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
    const activeDoctorsQuery = `SELECT COUNT(*) as active_count FROM users WHERE role = 'doctor';`;
    const doctorResult = await db.query(activeDoctorsQuery);
    
    const stats = statsResult.rows;
    const activeDoctors = parseInt(doctorResult.rows[0].active_count) || 1;

    let redCount = 0, totalCount = 0;
    stats.forEach(s => {
      const count = parseInt(s.count);
      totalCount += count;
      if (s.triage_category === 'RED') redCount += count;
    });

    let systemStatus = (redCount >= 3) ? 'CRITICAL' : (totalCount > 15 || redCount >= 1) ? 'HIGH' : 'NORMAL';

    res.status(200).json({ stats, system_status: systemStatus, active_doctors: activeDoctors });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// @desc    Get Queue (Filtered by Doctor or Criticality)
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
          ELSE 3 
        END, created_at DESC;
    `;
    const result = await db.query(query, [doctorId]);
    const parsedRows = result.rows.map(row => {
        let aiData = {};
        try {
            aiData = typeof row.raw_ai_response === 'string' ? JSON.parse(row.raw_ai_response) : row.raw_ai_response || {};
        } catch (e) {
            aiData = { reasoning: "Parsing error" };
        }
        return { ...row, ai_analysis: aiData };
    });
    res.status(200).json(parsedRows);
  } catch (error) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Resolve or Update Triage Category
const resolveTriage = async (req, res) => {
  try {
    const { id } = req.params;
    const { doctor_final_category } = req.body; 
    let query, values, actionType = 'UPDATE'; 

    if (doctor_final_category === 'TREATED') {
        query = `UPDATE health_reports SET is_resolved = TRUE, is_flagged_for_review = FALSE WHERE report_id = $1 RETURNING *;`;
        values = [id];
        actionType = 'REMOVE';
    } else {
        query = `UPDATE health_reports SET triage_category = $1, is_flagged_for_review = FALSE WHERE report_id = $2 RETURNING *;`;
        values = [doctor_final_category, id];
    }

    const result = await db.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: "Report not found" });

    if (req.io) req.io.emit('queue_update', { type: actionType, id, patient: result.rows[0] });

    res.json({ message: 'Resolved', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error resolving case' });
  }
};

module.exports = { submitTriageReport, getTriageStats, resolveTriage, getQueue };