from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel  # <--- Essential for the new Patient Model
import shutil
import os
import uuid

# --- SERVICE IMPORTS ---
from app.services.hearing import hearing_service
from app.services.brain import brain_service
from app.services.pharmacist import pharmacist_service
from app.services.registry import registry_service
from app.services.report import report_service

app = FastAPI(title="Vitalis API", version="1.0.0")

# --- CORS SETUP ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- DATA MODELS ---
class PatientCreate(BaseModel):
    name: str
    age: int
    medical_history: str

# --- ENDPOINTS ---

@app.get("/")
def read_root():
    return {"status": "Vitalis System Online"}

# 1. GET ALL PATIENTS (For the Dropdown)
@app.get("/patients/")
def get_patients():
    """Returns a list of all patients to display in the UI"""
    return registry_service.get_all_patients()

# 2. CREATE NEW PATIENT (For the Patient Registry Tab)
@app.post("/patients/")
def create_patient(patient: PatientCreate):
    """Allows the Doctor to add a new patient to the registry"""
    new_p = registry_service.create_patient(patient.name, patient.age, patient.medical_history)
    return {"id": new_p.id, "name": new_p.name, "status": "Registered"}

# 3. PROCESS CONSULTATION (Hear -> Think -> Verify -> Save)
@app.post("/consultation/") 
async def process_consultation(
    file: UploadFile = File(...), 
    patient_id: int = Form(...) 
):
    # A. Fetch Patient Data
    patient = registry_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    patient_context = f"Patient: {patient.name} (Age: {patient.age}). History: {patient.medical_history}"
    print(f"🏥 Processing Consultation for: {patient.name}")

    # B. Validate Audio File
    if not file.filename.endswith(("", ".wav", ".mp3", ".m4a", ".webm", ".blob")):
        raise HTTPException(status_code=400, detail="Invalid audio file.")

    # C. Save Audio Temporarily
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # D. THE AI PIPELINE
        
        # 1. HEAR (Transcribe)
        transcript = hearing_service.transcribe_audio(file_path)
        print(f"📝 Transcript: {transcript[:50]}...") # Print first 50 chars log
        
        # 2. THINK (SOAP Note)
        soap_note = brain_service.generate_soap_note(transcript)
        
        # 3. VERIFY (Safety Check)
        safety_check = pharmacist_service.check_safety(soap_note, patient_context)
        
        # 4. SAVE (Persist to Database) <--- CRITICAL NEW STEP
        registry_service.save_consultation(patient_id, soap_note, safety_check)
        
        # Cleanup
        os.remove(file_path)
        
        return {
            "transcript": transcript,
            "soap_note": soap_note,
            "safety_analysis": safety_check,
            "patient_context": patient_context
        }
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return {"error": str(e)}

# 4. GENERATE PDF REPORT
@app.post("/generate-report/")
async def generate_report_endpoint(
    patient_id: int = Form(...),
    soap_note: str = Form(...),
    safety_analysis: str = Form(...)
):
    # Fetch real patient name for the filename
    patient = registry_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # Generate PDF
    pdf_path = report_service.generate_report(
        patient.name, 
        patient.age, 
        soap_note, 
        safety_analysis
    )
    
    # Return file to user
    return FileResponse(pdf_path, media_type='application/pdf', filename=f"Medical_Report_{patient.name}.pdf")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)