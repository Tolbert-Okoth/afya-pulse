-- Security Note: This schema assumes PII is hashed before reaching the DB.
-- The 'patient_hash' allows us to track returning patients without knowing WHO they are.

CREATE TABLE IF NOT EXISTS health_reports (
    report_id SERIAL PRIMARY KEY,
    
    -- PRIVACY: Stores SHA-256(Salt + Phone). 
    -- Length 64 for standard hex representation of SHA-256.
    patient_hash VARCHAR(64) NOT NULL,
    
    -- TRIAGE DATA
    symptoms TEXT NOT NULL,
    
    -- INTEGRITY: Enforce strict categories to prevent 'garbage' data.
    triage_category VARCHAR(10) NOT NULL CHECK (triage_category IN ('GREEN', 'YELLOW', 'RED')),
    
    -- META DATA
    location VARCHAR(100), -- E.g., 'Nairobi, Westlands'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- SECURITY: Flag for reports that might need manual audit
    is_flagged_for_review BOOLEAN DEFAULT FALSE
);

-- PERFORMANCE & DOS PROTECTION:
-- Indexes speed up lookups, preventing slow queries that can exhaust DB CPU (DoS).
-- 1. Index for rapid dashboard filtering by severity.
CREATE INDEX idx_triage_category ON health_reports(triage_category);

-- 2. Index for location-based heatmaps.
CREATE INDEX idx_location ON health_reports(location);

-- 3. Index for time-range queries (e.g., "Last 24 hours").
CREATE INDEX idx_created_at ON health_reports(created_at);