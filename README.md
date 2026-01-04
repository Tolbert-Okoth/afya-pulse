# 🩺 Afya-Pulse  
## AI-Powered Healthcare Triage & Surveillance System

**Afya-Pulse** is a full-stack, real-time medical surveillance and AI-driven triage platform designed specifically for the **Kenyan healthcare context**.  
It leverages advanced AI to analyze patient symptoms (including **Sheng** and **Swahili**), categorize medical urgency, and provide **real-time visualization** for medical command centers.

---

## 📑 Table of Contents
- [Core Features](#-core-features)
- [Architecture](#-architecture)
- [Screenshots](#-screenshots)
- [Tech Stack](#-tech-stack)
- [Installation & Setup](#-installation--setup)
- [Security](#-security)

---

## ✨ Core Features

- **AI-Powered Triage**  
  Uses **Llama 3.3 (via Groq API)** to analyze patient symptoms and assign risk levels:
  - 🔴 RED (Critical)
  - 🟡 YELLOW (Moderate)
  - 🟢 GREEN (Low Risk)

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

## 🏗 Architecture

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

## 📸 Screenshots

<img width="1855" height="804" alt="Screenshot 2026-01-04 125019" src="https://github.com/user-attachments/assets/2a440d25-95bb-4558-9d41-f97fa8c41ea5" />




1. **Medical Command Center**  
   Real-time monitoring of patient load, response times, and active alerts.

2. **Nurse Kiosk (Patient Intake)**  
   Streamlined interface for registration and AI-assisted triage.

3. **Secure Authentication**  
   Firebase-powered login for Ministry of Health (MoH) staff.

4. **Health Monitoring**  
   24/7 uptime surveillance ensuring system reliability.

---

## 🛠 Tech Stack

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

## 🚀 Installation & Setup

### Environment Variables

#### AI Engine (`.env`)
```env
GROQ_API_KEY=your_key_here
SERVICE_SECRET_KEY=your_random_string_key
PORT=10000
