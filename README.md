# Vitalis 2.0: Sovereign AI Medical Intelligence Platform

![Status](https://img.shields.io/badge/Status-Production_Ready-success) ![Privacy](https://img.shields.io/badge/Privacy-Air_Gapped-green) ![AI](https://img.shields.io/badge/Agent-Voice_+_Vision_+_Reasoning-purple)

**Vitalis 2.0** is the world's first "Surgical-Grade" AI Operating System. It evolves beyond simple record-keeping into a **Voice-Controlled Clinical Co-Pilot**, allowing doctors to manage patient care entirely hands-free.

Designed for Apple Silicon, Vitalis ensures that **Patient Data Sovereignty** is absolute. From military-grade encrypted data transfer (Steganography) to real-time voice navigation, everything runs locally on the device.

Unlike cloud-based solutions, Vitalis processes audio, **analyzes medical images**, reasons about diagnoses, and checks for safety contraindications locally—ensuring that sensitive medical data never leaves the device.


---

## 🚀 New in Vitalis 2.0 (The "Omni" Update)

### 1. 🗣️ Omni Voice OS ("Surgical Mode")
Turn your clinic hands-free. The new **Omni Neural Engine** allows full system control via voice.
- **Wake Word Engine:** Always-listening background agent activates on *"Hey Vitalis"* or *"Hey Omni"*.
- **Smart Navigation:** "Open Victor Dam's records" instantly finds the patient and loads their history.
- **Contextual Readout:** The AI reads critical info aloud (Text-to-Speech) for busy doctors.
- **Direct Dictation:** "Add symptom: Severe Migraine" writes directly into the active patient file.

### 2. 🛂 Vitalis Passport (Secure Data Transfer)
A military-grade protocol for moving patient data between offline devices without the cloud.
- **Medical Steganography:** Hides encrypted patient databases inside standard X-Ray PNG images.
- **AES-256 Encryption:** Files are cryptographically sealed with a unique PIN.
- **Bio-Compression:** Compresses massive history logs by 90% for instant sharing.
- **AI Customs Officer:** An intelligent audit agent that scans incoming files for conflicts (e.g., "Incoming Passport lists Penicillin Allergy, local record does not") before merging.

### 3. 🧠 Intelligent Knowledge Base (RAG)
- **Medical RAG:** Upload medical PDFs (Guidelines, Research). The AI indexes them locally and cites them during consultations.
- **Deep Memory:** Omni remembers previous context in the chat ("What did I ask about his glucose levels previously?").

### 4. 🧪 Visual Lab Analysis
- **Trend Detection:** Automatically graphs numerical lab results (Glucose, HbA1c) to visualize patient progress over time.
- **Anomaly Flagging:** Highlights values outside standard reference ranges.

### 5. 👁️ Multimodal Vision Agent
- **Clinical Sight:** Integrates **LLaVA** to analyze medical images (X-Rays, MRI) locally.
- **Reasoning:** Detects fractures or anomalies and auto-drafts the "Objective" section of the SOAP note.

---
## Original Vitalis Features:
### 1. 🧠 Sovereign Multi-Agent System
- **The Scribe Agent:** Uses **Whisper (Distil)** to transcribe real-time consultations and **Llama 3.2** to synthesize structured SOAP notes.
- **The Pharmacist Agent:** A dedicated safety adversary that cross-references treatment plans against patient history to detect contraindications (Allergies, Drug Interactions).
- **Human-in-the-Loop:** Doctors can edit transcripts manually before generation to ensure 100% accuracy.

### 2. 🏥 Hospital OS Dashboard
- **Patient Registry:** A complete UI to onboard new patients and manage complex medical histories.
- **Electronic Health Records (EHR):** A timeline view of every past consultation, allowing doctors to revisit and download historical reports.
- **Persistent Database:** Powered by **SQLite + SQLAlchemy**, maintaining a secure, local-only patient database.

### 3. 📄 Bureaucracy Automation
- **Professional Reporting:** Generates branded, standardized PDF medical reports with visual safety indicators (Red/Green banners).
- **One-Click Launcher:** A unified shell script to boot the entire system (Frontend + Backend + AI Models) instantly.

--

## 🛠️ Technical Architecture (v2.0)

### **The "Cortex" (Backend)**
- **Core:** FastAPI (Python)
- **Omni Engine:** Custom Intent Router (Navigation vs. Action vs. Knowledge).
- **Speech:** `WebkitSpeechRecognition` (Frontend) + `SpeechSynthesis` (TTS).
- **Stealth:** `LSB Steganography` algorithm for data hiding.
- **Database:** SQLite + SQLAlchemy (Fully relational Patient-Consult-Lab mapping).

### **The "Face" (Frontend)**
- **UI:** Next.js 14 (App Router) with Glassmorphism.
- **Widget:** Floating "Omni Assistant" with real-time listening status (Purple/Red/Green states).
- **Visualization:** `Recharts` for Lab Data.

---

## ⚡ Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com/) running `llama3.2` and `llava`.

### 1. Installation
```bash
git clone [https://github.com/yourusername/vitalis.git](https://github.com/yourusername/vitalis.git)
cd vitalis

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app/main.py

# Frontend (New Terminal)
cd frontend
npm install
npm run dev