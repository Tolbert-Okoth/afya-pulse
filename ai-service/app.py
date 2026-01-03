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

# CORS: Allow requests from Frontend (3000/5173) and Node Backend (4000)
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://localhost:5173", "http://localhost:4000"]}})

# Rate Limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

if not GROQ_API_KEY and not ENABLE_MOCK_MODE:
    logger.warning("⚠️ WARNING: GROQ_API_KEY missing. AI engine disabled.")
    client = None
else:
    client = Groq(api_key=GROQ_API_KEY) if not ENABLE_MOCK_MODE else None

# ─────────────────────────────────────────────
# 2. AUTH DECORATOR
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
    
    # --- Mock Mode ---
    if ENABLE_MOCK_MODE:
        logger.info("Using mock mode.")
        return """
---
Patient Input: Mock Data
QUESTION_ASKED: None
RISK_LEVEL: GREEN
POTENTIAL_CAUSES: Mock Simulation
RATIONALE: Mock mode.
NEXT_ACTION: Consult a doctor.
---
        """

    if not client:
        return None

    if len(symptoms) > 2000:
        symptoms = symptoms[:2000] + " [truncated]"

    # --- Smart History & Turn Counting ---
    conversation_text = "No previous conversation."
    questions_asked_count = 0

    if history and isinstance(history, list):
        turns = []
        for turn in history[:12]: 
            role = turn.get("role", "user")
            content = str(turn.get("content", ""))[:800]
            if content.strip():
                # Count AI questions to enforce depth
                if role == "assistant" and "?" in content:
                    questions_asked_count += 1
                
                label = "PREVIOUS PATIENT ANSWER" if role == "user" else "YOUR PREVIOUS QUESTION"
                turns.append(f"{label}: {content}")
        if turns:
            conversation_text = "\n".join(turns)

    # --- THE BRAIN (Sheng-Proof + Depth Enforcer) ---
    system_prompt = f"""
You are an advanced medical triage AI.
Your goal: Analyze the conversation and determine the Risk Level (RED, YELLOW, GREEN).

## 🌍 LANGUAGE RULES (CRITICAL):
You must detect the nuance between "Sheng/Mixed" and "Pure Swahili".

1. **RULE: SHENG = ENGLISH OUTPUT**
   - IF input is mixed (e.g., "Niko na chest pain", "Manze I feel dizzy", "Kichwa inauma but no fever"), this is **Sheng**.
   - **ACTION:** Respond in **ENGLISH**.

2. **RULE: PURE SWAHILI = SWAHILI OUTPUT**
   - IF input is pure, standard Kiswahili (e.g., "Ninaumwa na kifua na ninashindwa kupumua vizuri").
   - **ACTION:** Respond in **KISWAHILI**.

3. **RULE: HEADERS MUST BE ENGLISH**
   - Regardless of the content language, the **HEADERS** (RISK_LEVEL, QUESTION_ASKED, etc.) MUST be in **ENGLISH**.

## 🚦 TRIAGE STRATEGY (DEPTH CONTROL):
You have currently asked: **{questions_asked_count}/5 questions**.

1. **IMMEDIATE RED:** If Red Flags (Chest Pain, Difficulty Breathing, Uncontrolled Bleeding, Confusion) are present -> **STOP ASKING**. Output RED immediately.
2. **DEPTH ENFORCER:** If no Red Flags are found and **{questions_asked_count} < 3**:
   - **YOU MUST ASK ANOTHER QUESTION.** Do not give a Final Verdict yet.
   - Use SOCRATES (Site, Onset, Character, Radiation, Associations, Time, Exacerbating, Severity).
3. **MAX LIMIT:** If {questions_asked_count} >= 5, you MUST give a Final Verdict now.

## 🛑 ANTI-LOOP RULES:
1. **NEVER** repeat a question found in the "Conversation History".
2. **PRIORITIZE** the "LATEST PATIENT ANSWER". If they updated severity (e.g. 6 -> 8), use the new number.

## 📝 OUTPUT FORMAT (Strict Headers)
Use this exact format. Do not use markdown bolding (**) in headers.

---
Patient Input: <Summary of Latest Answer>
QUESTION_ASKED: <Your Next Question (OR 'None' if Verdict Reached)>
RISK_LEVEL: <RED / YELLOW / GREEN>
POTENTIAL_CAUSES: <Cause 1, Cause 2>
RATIONALE: <Explanation in English (or Swahili ONLY if input was Pure Swahili)>
NEXT_ACTION: <Instruction in English (or Swahili ONLY if input was Pure Swahili)>
---

    === CONTEXT ===
    Patient: {age} yo {gender}
    Questions Asked So Far: {questions_asked_count}
    
    === CONVERSATION HISTORY (Do Not Repeat These) ===
    {conversation_text}
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
# 4. API ENDPOINT
# ─────────────────────────────────────────────
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

    # Fail-safe
    if not ai_response:
        return jsonify({
            "output": """
---
RISK_LEVEL: RED
RATIONALE: AI System Unavailable. Defaulting to safety.
NEXT_ACTION: Evaluate patient immediately.
---
            """
        }), 503

    return jsonify({"output": ai_response}), 200

# ─────────────────────────────────────────────
# 5. ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    logger.info("🧠 Afya-Pulse AI Engine running on Port 5000")
    app.run(port=5000, debug=True, threaded=True)