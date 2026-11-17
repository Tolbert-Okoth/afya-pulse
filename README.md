# Afya-Pulse
## AI-Powered Healthcare Triage & Surveillance System

**Built in 2025.** **Afya-Pulse** is a full-stack, real-time medical surveillance and AI-driven triage platform designed specifically for the **Kenyan healthcare context**.  
It leverages advanced AI to analyze patient symptoms (including **Sheng** and **Swahili**), categorize medical urgency, and provide **real-time visualization** for medical command centers.


## Core Features

- **AI-Powered Triage**  
  Uses **Llama 3.3 (via Groq API)** to analyze patient symptoms and assign risk levels:
  -  RED (Critical)
  -  YELLOW (Moderate)
  -  GREEN (Low Risk)

- **Real-Time Surveillance**  
  Doctors monitor incoming cases through a live **Medical Command Center** powered by **Socket.io**.

- **Multilingual Support**  
  Tuned to understand:
  - Kenyan English  
  - Swahili  
  - Sheng (urban slang)

- **Voice-to-Text Intake**  
  Hands-free speech recognition for fast and efficient patient data entry in clinical settings.

- **Outbreak Detection**  
  Automated alerts when clusters of high-risk cases emerge in specific geographical locations.

---

## Architecture

Afya-Pulse follows a **microservices-inspired architecture** for scalability and clear separation of concerns:

### Frontend
- **React**
- Deployed on **Vercel**
- Provides:
  - Nurse Kiosk (Patient Intake)
  - Doctor Dashboard (Command Center)

### API Gateway
- **Node.js + Express**
- Deployed on **Render**
- Responsibilities:
  - Authentication
  - Database operations
  - Real-time socket broadcasting

### AI Engine
- **Python + Flask**
- Deployed on **Render**
- Handles:
  - Medical triage logic
  - Integration with **Groq Llama-3 inference API**

### Database
- **PostgreSQL**
- Hosted on **Neon**
- Stores:
  - Patient reports
  - Medical history
  - User roles (Doctor, Nurse, Admin)

---

## Screenshots

<img width="1855" height="804" alt="Screenshot 2026-01-04 125019" src="https://github.com/user-attachments/assets/2a440d25-95bb-4558-9d41-f97fa8c41ea5" />
<img width="1833" height="816" alt="Screenshot 2026-01-04 125029" src="https://github.com/user-attachments/assets/bb0db886-4048-4a81-92ad-e2f9ddd2da66" />
<img width="1913" height="839" alt="Screenshot 2026-01-04 125049" src="https://github.com/user-attachments/assets/34eaf446-881e-418e-9534-8e5bca5e5022" />
<img width="1919" height="701" alt="Screenshot 2026-01-04 125102" src="https://github.com/user-attachments/assets/dae38cbb-c22c-4014-bf56-cc37938e3a5a" />







1. **Medical Command Center**  
   Real-time monitoring of patient load, response times, and active alerts.

2. **Nurse Kiosk (Patient Intake)**  
   Streamlined interface for registration and AI-assisted triage.

3. **Secure Authentication**  
   Firebase-powered login for clinical staff.

4. **Health Monitoring**  
   24/7 uptime surveillance ensuring system reliability.

---

## Tech Stack

| Component | Technology |
|---------|-----------|
| Frontend | React, Vite, Lucide-React, Recharts |
| Backend | Node.js, Express, Socket.io |
| AI Service | Python, Flask, Groq API, Llama 3.3 |
| Database | PostgreSQL (Neon DB) |
| Authentication | Firebase Authentication |
| Deployment | Vercel (Frontend), Render (Backend & AI) |
| Monitoring | UptimeRobot |

---

## Installation & Setup

### Environment Variables

#### AI Engine (`.env`)
```env
GROQ_API_KEY=your_key_here
SERVICE_SECRET_KEY=your_random_string_key
PORT=10000
```

### Run locally

```bash
git clone https://github.com/Tolbert-Okoth/afya-pulse.git
cd afya-pulse

# AI service
cd ai-service && pip install -r requirements.txt && python app.py

# API gateway (new terminal)
cd backend-node && npm install && node server.js

# Dashboard (new terminal)
cd frontend-dashboard && npm install && npm run dev
```

The backend and dashboard also need their own `.env` files (database URL, Firebase config, AI service URL and the shared `SERVICE_SECRET_KEY`).

---

## Security

- **Service-to-service authentication:** the backend and AI service share a `SERVICE_SECRET_KEY`.
- **Token refreshing:** Firebase `onIdTokenChanged` keeps sessions alive through long clinical shifts.
- **CORS protection:** strict origin filtering blocks unauthorized API calls.

---

## Built for Kenya

Afya-Pulse is designed around local languages, patchy infrastructure and public-health needs.

> **Prototype.** Afya-Pulse is a portfolio project and has not been clinically validated. Triage suggestions must be confirmed by a qualified clinician.

Built by **Tolbert Okoth**: [GitHub](https://github.com/Tolbert-Okoth) · [LinkedIn](https://www.linkedin.com/in/tolbert-asumba-542b3b344)
