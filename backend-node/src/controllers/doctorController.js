const pool = require('../config/db'); // Import the file created above

exports.getDoctorDashboardData = async (req, res) => {
  try {
    // 1. Get the ID from the logged-in user (decoded from JWT in middleware)
    const loggedInDoctorId = req.user.id; 

    // 2. Query data specifically for this doctor
    // Adjust table names (e.g., 'appointments', 'triage_records') to match your schema
    const query = `
      SELECT 
        id, 
        patient_name, 
        symptoms, 
        priority_level, 
        created_at
      FROM triage_records 
      WHERE doctor_id = $1 
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [loggedInDoctorId]);

    // 3. Return the filtered list
    if (result.rows.length === 0) {
      return res.json({ message: "No records found for this doctor." });
    }

    res.json(result.rows);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};