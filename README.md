# Vitalis: Sovereign AI Medical Intelligence Platform (v1.2)

![Status](https://img.shields.io/badge/Status-Production_Ready-success) ![Privacy](https://img.shields.io/badge/Privacy-100%25_Offline-green) ![AI](https://img.shields.io/badge/Multimodal-Vision_+_Audio-purple)

**Vitalis** is a commercial-grade, privacy-first medical AI operating system designed to run entirely on edge hardware (Apple Silicon). It addresses the critical need for AI utility in healthcare without compromising patient data sovereignty.

Unlike cloud-based solutions, Vitalis processes audio, **analyzes medical images**, reasons about diagnoses, and checks for safety contraindications locally—ensuring that sensitive medical data never leaves the device.

---

## 🚀 Key Features (v1.2)

### 1. 👁️ Multimodal Vision Agent (New)
- **Clinical Sight:** Integrates **LLaVA (Large Language-and-Vision Assistant)** to analyze medical images (X-Rays, MRI, Skin Lesions) locally.
- **Contextual Reasoning:** The AI automatically incorporates visual findings into the SOAP note (e.g., detecting a fracture in an uploaded X-Ray and adjusting the Treatment Plan accordingly).

### 2. 🧠 Sovereign Multi-Agent System
- **The Scribe Agent:** Uses **Whisper (Distil)** to transcribe real-time consultations and **Llama 3.2** to synthesize structured SOAP notes.
- **The Pharmacist Agent:** A dedicated safety adversary that cross-references treatment plans against patient history to detect contraindications (Allergies, Drug Interactions).
- **Human-in-the-Loop:** Doctors can edit transcripts manually before generation to ensure 100% accuracy.

### 3. 🏥 Hospital OS Dashboard
- **Patient Registry:** A complete UI to onboard new patients and manage complex medical histories.
- **Electronic Health Records (EHR):** A timeline view of every past consultation, allowing doctors to revisit and download historical reports.
- **Persistent Database:** Powered by **SQLite + SQLAlchemy**, maintaining a secure, local-only patient database.

### 4. 📄 Bureaucracy Automation
- **Professional Reporting:** Generates branded, standardized PDF medical reports with visual safety indicators (Red/Green banners).
- **One-Click Launcher:** A unified shell script to boot the entire system (Frontend + Backend + AI Models) instantly.

---

## 🛠️ Technical Architecture

Vitalis utilizes a modern Monorepo architecture optimized for Apple Silicon (M-Series chips).

### **Frontend (The Face)**
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + Lucide React
- **Features:** Sidebar Navigation, Patient Timeline, Image Drag-and-Drop, Real-time Status.

### **Backend (The Brain)**
- **API:** FastAPI (Python)
- **Database:** SQLite (via SQLAlchemy)
- **AI Engine:**
  - **Hearing:** `faster-whisper` (Optimized for CoreML/MPS)
  - **Vision:** `Ollama` running **LLaVA**
  - **Reasoning:** `Ollama` running **Llama 3.2 3B**

---

## ⚡ Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com/) installed.
- Models pulled: `ollama pull llama3.2` and `ollama pull llava`
- [FFmpeg](https://ffmpeg.org/) (`brew install ffmpeg`)

### 1. Clone & Setup Backend
```bash
git clone [https://github.com/yourusername/vitalis.git](https://github.com/yourusername/vitalis.git)
cd vitalis/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt