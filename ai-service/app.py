import os
import json
from typing import List
from flask import Flask, request, jsonify
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

# ✅ ENHANCED CORS: Allow all subdomains of Vercel and Render for flexibility
CORS(app, resources={r"/*": {
    "origins": [
        "http://localhost:3000", 
        "http://localhost:5173", 
        "http://localhost:4000",
        "https://afya-pulse.vercel.app",
        "https://afya-pulse-dashboard.vercel.app",
        "https://afya-pulse-backend.onrender.com"
    ],
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "X-Service-Key"]
}})

# Rate Limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["500 per day", "100 per hour"], # Increased for USSD bursts
    storage_uri="memory://"
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Groq Client Initialization
client = None
if not ENABLE_MOCK_MODE:
    if not GROQ_API_KEY:
        logger.error("❌ CRITICAL: GROQ_API_KEY missing. Set it in Render Environment Variables.")
    else:
        client = Groq(api_key=GROQ_API_KEY)

# ─────────────────────────────────────────────
# 2. AUTH DECORATOR
# ─────────────────────────────────────────────
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Allow health checks to bypass auth for Render's uptime monitor
        if request.method == 'GET' and request.path in ['/', '/health']:
            return f(*args, **kwargs)
            
        auth_key = request.headers.get('X-Service-Key')
        if not auth_key or auth_key != SERVICE_SECRET_KEY:
            logger.warning(f"🚫 Auth failed: Invalid key from {request.remote_addr}")
            return jsonify({"error": "Auth Verification Failed"}), 401
        return f(*args, **kwargs)
    return decorated

# ─────────────────────────────────────────────
# 3. AI CORE LOGIC
# ─────────────────────────────────────────────
def get_medical_analysis(symptoms: str, age: str, gender: str, history: List[dict] | None = None):
    if ENABLE_MOCK_MODE:
        return "---\nQUESTION_ASKED: None\nRISK_LEVEL: GREEN\nPOTENTIAL_CAUSES: Mock Cause\nRATIONALE: Mocking enabled.\nNEXT_ACTION: No action.\n---"

    if not client:
        return None

    # Turn Counting
    questions_asked_count = 0
    turns = []
    if history:
        for turn in history[-10:]: # Look at last 10 turns
            role = turn.get("role")
            content = turn.get("content", "")
            if role == "assistant" and "?" in content:
                questions_asked_count += 1
            turns.append(f"{'PATIENT' if role == 'user' else 'AI'}: {content}")

    conversation_text = "\n".join(turns) if turns else "No previous history."

    system_prompt = f"""
You are the Afya-Pulse Triage AI. 
Analyze symptoms and return a structured verdict.

## 🌍 LANGUAGE RULES:
1. Detect SHENG (Mixed English/Swahili) -> Respond in ENGLISH.
2. Detect PURE SWAHILI -> Respond in SWAHILI.
3. HEADERS (RISK_LEVEL, etc.) MUST ALWAYS BE ENGLISH.

## 🚦 TRIAGE STRATEGY:
- RED FLAGS (Chest pain, breathing difficulty, severe bleeding, confusion) -> STOP ASKING. RISK_LEVEL: RED.
- If no red flags and < 3 questions asked -> ASK A FOLLOW-UP QUESTION.
- If >= 5 questions asked -> GIVE FINAL VERDICT.

## 📝 OUTPUT FORMAT:
---
Patient Input: <Summary>
QUESTION_ASKED: <Question or 'None'>
RISK_LEVEL: <RED/YELLOW/GREEN>
POTENTIAL_CAUSES: <Causes split by commas>
RATIONALE: <Explanation>
NEXT_ACTION: <Instruction>
---
    """

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"CONTEXT: Age {age}, Gender {gender}. History: {conversation_text}\nLATEST SYMPTOMS: {symptoms}"}
            ],
            temperature=0.1,
            max_tokens=600
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Groq Error: {e}")
        return None

# ─────────────────────────────────────────────
# 4. API ENDPOINTS
# ─────────────────────────────────────────────

@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "AI Service Online", "mock_mode": ENABLE_MOCK_MODE}), 200

@app.route("/predict", methods=["POST"])
@require_auth
def predict():
    data = request.get_json(silent=True) or {}
    symptoms = str(data.get("symptoms", "")).strip()
    
    if not symptoms:
        return jsonify({"error": "Symptoms required"}), 400

    ai_response = get_medical_analysis(
        symptoms, 
        str(data.get("age", "Unknown")), 
        str(data.get("gender", "Unknown")), 
        data.get("history", [])
    )

    if not ai_response:
        return jsonify({"output": "RISK_LEVEL: RED\nRATIONALE: AI Error\nNEXT_ACTION: Immediate Evaluation"}), 503

    return jsonify({"output": ai_response}), 200

if __name__ == "__main__":
    # Binding to 0.0.0.0 is mandatory for Render
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)