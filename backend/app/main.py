from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import shutil
import os
import uuid

# --- SERVICE IMPORTS ---
from app.services.hearing import hearing_service
from app.services.brain import brain_service
from app.services.pharmacist import pharmacist_service
# FIX: Imported 'Consultation' here so the download endpoint can find it
from app.services.registry import registry_service, Consultation 
from app.services.report import report_service

from app.services.vision import vision_service
from typing import Optional 

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

# 1. GET ALL PATIENTS
@app.get("/patients/")
def get_patients():
    """Returns a list of all patients to display in the UI"""
    return registry_service.get_all_patients()

# 2. CREATE NEW PATIENT
@app.post("/patients/")
def create_patient(patient: PatientCreate):
    """Allows the Doctor to add a new patient to the registry"""
    new_p = registry_service.create_patient(patient.name, patient.age, patient.medical_history)
    return {"id": new_p.id, "name": new_p.name, "status": "Registered"}

# 3. PROCESS CONSULTATION
@app.post("/consultation/") 
async def process_consultation(
    file: UploadFile = File(...),      # Audio
    image: Optional[UploadFile] = File(None), # Image (Optional)
    patient_id: int = Form(...) 
):
    # 1. Fetch Patient
    patient = registry_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    patient_context = f"Patient: {patient.name} (Age: {patient.age}). History: {patient.medical_history}"

    # 2. Save Audio
    file_id = str(uuid.uuid4())
    audio_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 3. Handle Image (If provided)
    visual_findings = "No image provided."
    if image:
        image_path = os.path.join(UPLOAD_DIR, f"{file_id}_{image.filename}")
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        
        # --- VISION AGENT ACTS HERE ---
        visual_findings = vision_service.analyze_image(image_path)
        print(f"👁️ Visual Analysis: {visual_findings}")
        
        # Cleanup image later
        os.remove(image_path)

    try:
        # 4. HEAR
        transcript = hearing_service.transcribe_audio(audio_path)
        
        # 5. THINK (Now with Visual Context!)
        # We append the visual findings to the transcript so the Brain considers it
        combined_input = f"AUDIO TRANSCRIPT: {transcript}\n\nVISUAL FINDINGS FROM IMAGE: {visual_findings}"
        
        soap_note = brain_service.generate_soap_note(combined_input)
        
        # 6. VERIFY
        safety_check = pharmacist_service.check_safety(soap_note, patient_context)
        
        # 7. SAVE
        registry_service.save_consultation(patient_id, soap_note, safety_check)
        
        os.remove(audio_path)
        
        return {
            "transcript": transcript,
            "visual_analysis": visual_findings, # Return this to UI
            "soap_note": soap_note,
            "safety_analysis": safety_check,
            "patient_context": patient_context
        }
    
    except Exception as e:
        return {"error": str(e)}

# 4. GENERATE PDF REPORT (For Current Session)
@app.post("/generate-report/")
async def generate_report_endpoint(
    patient_id: int = Form(...),
    soap_note: str = Form(...),
    safety_analysis: str = Form(...)
):
    patient = registry_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    pdf_path = report_service.generate_report(
        patient.name, 
        patient.age, 
        soap_note, 
        safety_analysis
    )
    
    return FileResponse(pdf_path, media_type='application/pdf', filename=f"Medical_Report_{patient.name}.pdf")

# 5. GET PATIENT HISTORY
@app.get("/patients/{patient_id}/history")
def get_patient_history(patient_id: int):
    """Fetch full consultation history for a specific patient"""
    patient = registry_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    history = []
    # Use the relationship defined in registry.py
    for consult in patient.consultations:
        history.append({
            "id": consult.id,
            "timestamp": consult.timestamp,
            "soap_note": consult.soap_note,
            "safety_analysis": consult.safety_analysis
        })
    
    history.reverse()
    
    return {
        "patient": {"name": patient.name, "age": patient.age, "history": patient.medical_history},
        "consultations": history
    }

# 6. TEXT-ONLY ANALYSIS (For Editing/Regenerating)
@app.post("/analyze-text/")
async def analyze_text(
    text: str = Form(...),
    patient_id: int = Form(...)
):
    patient = registry_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    patient_context = f"Patient: {patient.name} (Age: {patient.age}). History: {patient.medical_history}"

    soap_note = brain_service.generate_soap_note(text)
    safety_check = pharmacist_service.check_safety(soap_note, patient_context)
    
    # Save the correction as a new record
    registry_service.save_consultation(patient_id, soap_note, safety_check)
    
    return {
        "soap_note": soap_note,
        "safety_analysis": safety_check
    }

# 7. DOWNLOAD HISTORY PDF 
@app.get("/consultations/{consultation_id}/download")
def download_consultation_pdf(consultation_id: int):
    # Now this works because we imported Consultation at the top
    db = registry_service.db
    consult = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    
    if not consult:
        raise HTTPException(status_code=404, detail="Consultation not found")
        
    pdf_path = report_service.generate_report(
        patient_name=consult.patient.name,
        patient_age=consult.patient.age,
        soap_note=consult.soap_note,
        safety_analysis=consult.safety_analysis,
        timestamp=consult.timestamp
    )
    
    return FileResponse(pdf_path, media_type='application/pdf', filename=f"Record_{consult.patient.name}_{consult.id}.pdf")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)