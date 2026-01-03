const axios = require('axios');
const db = require('../config/db');

// 🛡️ Production Config
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000/predict';
const AI_SECRET_KEY = process.env.SERVICE_SECRET_KEY || "default_insecure_key"; 

// --- HELPER: REGEX PARSER ---
const extractAI = (text, regex) => {
  const match = text.match(regex);
  return match && match[1] ? match[1].trim() : null;
};

// @desc    Submit a new Health Report
// @route   POST /api/triage
const submitTriageReport = async (req, res) => {
  try {
    const { symptoms, location, age, gender, phone, history } = req.body; 
    const doctorId = req.user ? req.user.id : null; 

    if (!symptoms) return res.status(400).json({ error: 'Symptoms are required' });

    let rawAiOutput = null;
    let triageCategory = 'RED'; 
    let aiAnalysis = { reasoning: 'AI Fallback', follow_up_questions: [], possible_conditions: [], advice: 'Seek help.' };

    try {
      const response = await axios.post(AI_SERVICE_URL, {
        symptoms, age, gender, history: history || [] 
      }, {
        headers: { 'X-Service-Key': AI_SECRET_KEY },
        timeout: 8000 
      });

      if (response.data?.output) {
        rawAiOutput = response.data.output;
        const out = rawAiOutput.toUpperCase();

        triageCategory = out.includes('RISK_LEVEL: GREEN') ? 'GREEN' : 
                         out.includes('RISK_LEVEL: YELLOW') ? 'YELLOW' : 'RED';

        aiAnalysis = {
          raw_output: rawAiOutput,
          reasoning: extractAI(rawAiOutput, /RATIONALE:\s*(.*)/i) || "Analysis Complete",
          follow_up_questions: extractAI(rawAiOutput, /QUESTION_ASKED:\s*(.*)/i)?.split(',').filter(q => q.toLowerCase() !== 'none') || [],
          possible_conditions: extractAI(rawAiOutput, /POTENTIAL_CAUSES:\s*(.*)/i)?.split(',').map(c => c.trim()) || [],
          advice: extractAI(rawAiOutput, /NEXT_ACTION:\s*(.*)/i) || "Consult a doctor."
        };
      }
    } catch (aiError) {
      console.error('⚠️ AI Service unreachable. Fallback triggered.');
    }

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

    // Outbreak Detection
    if (triageCategory === 'RED') {
      const cluster = await db.query(
        `SELECT COUNT(*) FROM health_reports WHERE location = $1 AND triage_category = 'RED' AND created_at >= NOW() - INTERVAL '1 hour'`,
        [location]
      );
      if (parseInt(cluster.rows[0].count) >= 3 && req.io) {
        req.io.emit('OUTBREAK_ALERT', { location, count: cluster.rows[0].count });
      }
    }

    if (req.io) {
      req.io.emit('queue_update', { type: 'ADD', patient: { ...newPatient, ai_analysis: aiAnalysis } });
    }

    res.status(201).json({ data: newPatient, ai_analysis: aiAnalysis });

  } catch (error) {
    console.error('Controller Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// @desc    Get Stats for Dashboard
// @route   GET /api/triage/stats
const getTriageStats = async (req, res) => {
  try {
    const doctorId = req.user?.id;
    const statsResult = await db.query(`
      SELECT triage_category, COUNT(*) as count FROM health_reports 
      WHERE (is_resolved = FALSE OR is_resolved IS NULL)
      GROUP BY triage_category;
    `);

    const doctorResult = await db.query(`SELECT COUNT(*) as active_count FROM users WHERE role = 'doctor'`);
    
    res.status(200).json({
      stats: statsResult.rows,
      active_doctors: parseInt(doctorResult.rows[0].active_count) || 1
    });
  } catch (error) {
    res.status(500).json({ error: 'Stats fetch failed' });
  }
};

// @desc    Get Patient Queue
// @route   GET /api/triage/queue
const getQueue = async (req, res) => {
  try {
    const doctorId = req.user?.id;
    const result = await db.query(`
      SELECT * FROM health_reports 
      WHERE (is_resolved = FALSE OR is_resolved IS NULL) 
      ORDER BY 
        CASE 
          WHEN triage_category = 'RED' THEN 1 
          WHEN triage_category = 'YELLOW' THEN 2
          ELSE 3 
        END, created_at DESC;
    `);

    const parsedRows = result.rows.map(row => ({
      ...row,
      ai_analysis: typeof row.raw_ai_response === 'string' ? JSON.parse(row.raw_ai_response) : row.raw_ai_response
    }));

    res.status(200).json(parsedRows);
  } catch (error) {
    res.status(500).json({ error: 'Queue fetch failed' });
  }
};

// @desc    Resolve Case
// @route   PATCH /api/triage/resolve/:id
const resolveTriage = async (req, res) => {
  try {
    const { id } = req.params;
    const { doctor_final_category } = req.body; 
    const isTreated = doctor_final_category === 'TREATED';

    const query = isTreated ? 
      `UPDATE health_reports SET is_resolved = TRUE WHERE report_id = $1 RETURNING *` :
      `UPDATE health_reports SET triage_category = $1 WHERE report_id = $2 RETURNING *`;

    const result = await db.query(query, isTreated ? [id] : [doctor_final_category, id]);
    
    if (req.io) {
      req.io.emit('queue_update', { type: isTreated ? 'REMOVE' : 'UPDATE', id, patient: result.rows[0] });
    }

    res.json({ message: 'Resolved', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Resolve failed' });
  }
};

module.exports = { submitTriageReport, getTriageStats, resolveTriage, getQueue };