import os
import json
from typing import List
from flask import Flask, request, jsonify, abort
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from functools import wraps
from dotenv import load_dotenv
from groq import Groq
import logging

# ─────────────────────────────────────────────
# 1. SETUP & CONFIGURATION
# ─────────────────────────────────────────────
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
ENABLE_MOCK_MODE = os.getenv("ENABLE_MOCK_MODE", "False").lower() == "true"
SERVICE_SECRET_KEY = os.getenv("SERVICE_SECRET_KEY", "default_insecure_key")

app = Flask(__name__)

# CORS: Configured for Vercel Frontend, Node Backend, and Local Dev
CORS(app, resources={r"/*": {
    "origins": [
        "http://localhost:3000", 
        "http://localhost:5173", 
        "http://localhost:4000",
        "https://afya-pulse.vercel.app",             # Main Vercel App
        "https://afya-pulse-dashboard.vercel.app",   # Vercel Dashboard
        "https://afya-pulse.onrender.com"            # Node Backend on Render
    ],
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "X-Service-Key"]
}})

# Rate Limiting (Memory storage for easy deployment)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Logging Setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize AI Client
if not GROQ_API_KEY and not ENABLE_MOCK_MODE:
    logger.warning("⚠️ WARNING: GROQ_API_KEY missing. AI engine disabled.")
    client = None
else:
    client = Groq(api_key=GROQ_API_KEY) if not ENABLE_MOCK_MODE else None

# ─────────────────────────────────────────────
# 2. AUTH DECORATOR (Shared Secret Key)
# ─────────────────────────────────────────────
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_key = request.headers.get('X-Service-Key')
        if not auth_key or auth_key != SERVICE_SECRET_KEY:
            logger.warning(f"Auth failed: Invalid key from {request.remote_addr}")
            return jsonify({"error": "Auth Verification Failed"}), 401
        return f(*args, **kwargs)
    return decorated

# ─────────────────────────────────────────────
# 3. AI CORE LOGIC
# ─────────────────────────────────────────────
def get_medical_analysis(symptoms: str, age: str, gender: str, history: List[dict] | None = None):
    if ENABLE_MOCK_MODE:
        return "---\nPatient Input: Mock Data\nQUESTION_ASKED: None\nRISK_LEVEL: GREEN\nPOTENTIAL_CAUSES: Mock Simulation\nRATIONALE: Mock mode active.\nNEXT_ACTION: Consult a doctor.\n---"

    if not client:
        return None

    # Handle history and turn counting
    conversation_text = "No previous conversation."
    questions_asked_count = 0
    if history and isinstance(history, list):
        turns = []
        for turn in history[:12]: 
            role = turn.get("role", "user")
            content = str(turn.get("content", ""))[:800]
            if content.strip():
                if role == "assistant" and "?" in content:
                    questions_asked_count += 1
                label = "PREVIOUS PATIENT ANSWER" if role == "user" else "YOUR PREVIOUS QUESTION"
                turns.append(f"{label}: {content}")
        if turns:
            conversation_text = "\n".join(turns)

    # System Prompt for Triage Logic
    system_prompt = f"""
You are an advanced medical triage AI.
Goal: Analyze symptoms and determine Risk Level (RED, YELLOW, GREEN).

## 🌍 LANGUAGE RULES:
1. SHENG (Mixed Input) = Respond in ENGLISH.
2. PURE SWAHILI = Respond in KISWAHILI.
3. HEADERS = ALWAYS ENGLISH (e.g., RISK_LEVEL).

## 🚦 TRIAGE STRATEGY:
Current depth: {questions_asked_count}/5.
1. RED FLAGS: Chest Pain, Difficulty Breathing -> STOP ASKING. Output RED immediately.
2. DEPTH: If < 3 questions asked and no red flags -> ASK ANOTHER QUESTION.
3. FINAL: If >= 5 questions -> GIVE FINAL VERDICT.

## 📝 OUTPUT FORMAT (Strict)
---
Patient Input: <Summary>
QUESTION_ASKED: <Next Question OR 'None'>
RISK_LEVEL: <RED / YELLOW / GREEN>
POTENTIAL_CAUSES: <Cause 1, Cause 2>
RATIONALE: <Explanation>
NEXT_ACTION: <Instruction>
---
    """

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"LATEST PATIENT ANSWER: {symptoms}"}
            ],
            temperature=0.1, 
            max_tokens=600
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Groq API Error: {e}")
        return None

# ─────────────────────────────────────────────
# 4. API ENDPOINTS
# ─────────────────────────────────────────────

# Health Check
@app.route("/", methods=["GET", "HEAD"])
@app.route("/health", methods=["GET", "HEAD"])
def health_check():
    return jsonify({
        "status": "Afya-Pulse AI Service Operational", 
        "port": os.environ.get("PORT", 10000),
        "region": "Oregon (Internal)"
    }), 200

# Predict Triage
@app.route("/predict", methods=["POST"])
@require_auth
@limiter.limit("30 per minute")
def predict():
    data = request.get_json(silent=True) or {}
    symptoms = str(data.get("symptoms", "")).strip()[:2000]
    
    if not symptoms:
        return jsonify({"error": "Symptoms required"}), 400

    ai_response = get_medical_analysis(
        symptoms, 
        str(data.get("age", "Unknown")), 
        str(data.get("gender", "Unknown")), 
        data.get("history", [])
    )

    if not ai_response:
        return jsonify({
            "output": "---\nRISK_LEVEL: RED\nRATIONALE: AI Connection Error.\nNEXT_ACTION: Evaluate immediately.\n---"
        }), 503

    return jsonify({"output": ai_response}), 200

# ─────────────────────────────────────────────
# 5. ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    # Binding to 0.0.0.0 is required for Render's internal networking
    port = int(os.environ.get("PORT", 10000)) 
    logger.info(f"🧠 Afya-Pulse AI Engine running on Port {port}")
    app.run(host="0.0.0.0", port=port, threaded=True)