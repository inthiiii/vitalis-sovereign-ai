from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import shutil
import os
import uuid
import ollama
from typing import Optional, Union, List
from datetime import datetime

# --- SERVICE IMPORTS ---
from app.services.hearing import hearing_service
from app.services.brain import brain_service
from app.services.pharmacist import pharmacist_service
from app.services.registry import registry_service, Consultation 
from app.services.report import report_service
from app.services.vision import vision_service
from app.services.knowledge import knowledge_service 
from langchain_community.document_loaders import PyPDFLoader
from app.services.house import house_service
from app.services.omni import omni_service
from app.services.lab import lab_service
from app.services.passport import passport_service

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
    return registry_service.get_all_patients()

# 2. CREATE NEW PATIENT
@app.post("/patients/")
def create_patient(patient: PatientCreate):
    new_p = registry_service.create_patient(patient.name, patient.age, patient.medical_history)
    return {"id": new_p.id, "name": new_p.name, "status": "Registered"}

# 3. PROCESS CONSULTATION
@app.post("/consultation/") 
async def process_consultation(
    file: UploadFile = File(...),
    image: Optional[UploadFile] = File(None),
    patient_id: int = Form(...),
    use_rag: bool = Form(True)
):
    patient = registry_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    patient_context = f"Patient: {patient.name} (Age: {patient.age}). History: {patient.medical_history}"

    file_id = str(uuid.uuid4())
    audio_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    visual_findings = "No image provided."
    if image:
        image_path = os.path.join(UPLOAD_DIR, f"{file_id}_{image.filename}")
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        visual_findings = vision_service.analyze_image(image_path)
        os.remove(image_path)

    try:
        transcript = hearing_service.transcribe_audio(audio_path)
        combined_input = f"AUDIO TRANSCRIPT: {transcript}\n\nVISUAL FINDINGS FROM IMAGE: {visual_findings}"
        soap_note = brain_service.generate_soap_note(combined_input, use_rag=use_rag)
        safety_check = pharmacist_service.check_safety(soap_note, patient_context)
        registry_service.save_consultation(patient_id, soap_note, safety_check)
        os.remove(audio_path)
        
        return {
            "transcript": transcript,
            "visual_analysis": visual_findings,
            "soap_note": soap_note,
            "safety_analysis": safety_check,
            "patient_context": patient_context
        }
    except Exception as e:
        return {"error": str(e)}

# 4. GENERATE PDF REPORT
@app.post("/generate-report/")
async def generate_report_endpoint(
    patient_id: int = Form(...),
    soap_note: str = Form(...),
    safety_analysis: str = Form(...)
):
    patient = registry_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    pdf_path = report_service.generate_report(patient.name, patient.age, soap_note, safety_analysis)
    return FileResponse(pdf_path, media_type='application/pdf', filename=f"Medical_Report_{patient.name}.pdf")

# 5. GET PATIENT HISTORY
@app.get("/patients/{patient_id}/history")
def get_patient_history(patient_id: int):
    patient = registry_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    history = []
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

# 6. TEXT-ONLY ANALYSIS
@app.post("/analyze-text/")
async def analyze_text(
    text: str = Form(...),
    patient_id: int = Form(...),
    use_rag: bool = Form(True)
):
    patient = registry_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    patient_context = f"Patient: {patient.name} (Age: {patient.age}). History: {patient.medical_history}"
    soap_note = brain_service.generate_soap_note(text, use_rag=use_rag)
    safety_check = pharmacist_service.check_safety(soap_note, patient_context)
    registry_service.save_consultation(patient_id, soap_note, safety_check)
    return {"soap_note": soap_note, "safety_analysis": safety_check}

# 7. DOWNLOAD HISTORY PDF 
@app.get("/consultations/{consultation_id}/download")
def download_consultation_pdf(consultation_id: int):
    db = registry_service.db
    consult = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consult:
        raise HTTPException(status_code=404, detail="Consultation not found")
    pdf_path = report_service.generate_report(
        consult.patient.name, consult.patient.age, consult.soap_note, consult.safety_analysis, consult.timestamp
    )
    return FileResponse(pdf_path, media_type='application/pdf', filename=f"Record_{consult.patient.name}_{consult.id}.pdf")

# 8. KNOWLEDGE BASE MANAGEMENT
@app.post("/knowledge/upload/")
async def upload_knowledge(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    try:
        chunks = knowledge_service.ingest_pdf(file_path)
        library_dir = "library"
        os.makedirs(library_dir, exist_ok=True)
        shutil.move(file_path, os.path.join(library_dir, file.filename))
        return {"status": "success", "chunks_indexed": chunks, "filename": file.filename}
    except Exception as e:
        return {"error": str(e)}

# 9. LIST KNOWLEDGE
@app.get("/knowledge/list/")
def list_knowledge():
    library_dir = "library"
    if not os.path.exists(library_dir): return []
    return [f for f in os.listdir(library_dir) if f.endswith('.pdf')]

# 10. DELETE KNOWLEDGE
@app.delete("/knowledge/{filename}")
def delete_knowledge(filename: str):
    library_dir = "library"
    file_path = os.path.join(library_dir, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="File not found")

# 11. PATIENT EXPLANATION
@app.post("/explain/")
async def explain_to_patient(soap_note: str = Form(...), patient_name: str = Form(...)):
    prompt = f"""You are a compassionate medical assistant speaking directly to {patient_name}. INPUT: "{soap_note}". TASK: Summarize the Plan for the patient in simple, warm language."""
    response = ollama.chat(model="llama3.2", messages=[{'role': 'user', 'content': prompt}])
    return {"explanation": response['message']['content']}

# 12. SECOND OPINION
@app.post("/second-opinion/")
async def get_second_opinion(soap_note: str = Form(...)):
    ddx = house_service.get_second_opinion(soap_note)
    return {"ddx": ddx}

# 13. EXTRACT PATIENT PDF
@app.post("/patients/extract-from-pdf/")
async def extract_patient_from_pdf(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, f"temp_patient_{uuid.uuid4()}.pdf")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    try:
        loader = PyPDFLoader(file_path)
        pages = loader.load()
        text_content = "\n".join([p.page_content for p in pages])
        prompt = f"""Extract patient details from this text into JSON. TEXT: "{text_content[:2000]}". OUTPUT FORMAT: {{"name": "Full Name", "age": 0, "medical_history": "Summary"}}"""
        response = ollama.chat(model="llama3.2", messages=[{'role': 'system', 'content': 'You are a JSON extractor.'}, {'role': 'user', 'content': prompt}])
        os.remove(file_path)
        import json
        clean_json = response['message']['content'].replace("```json", "").replace("```", "").strip()
        return json.loads(clean_json)
    except Exception as e:
        if os.path.exists(file_path): os.remove(file_path)
        return {"error": str(e)}

# 14. DELETE RECORD
@app.delete("/consultations/{consultation_id}")
def delete_consultation(consultation_id: int):
    db = registry_service.db
    record = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if record:
        db.delete(record)
        db.commit()
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Record not found")

# 15. OMNI CHAT
@app.post("/omni/chat/")
async def omni_chat(
    message: str = Form(...), 
    use_memory: bool = Form(True) # Defaults to True if not sent
):
    response = omni_service.chat(message, use_memory)
    return {"response": response}

# 16. LAB EXTRACT
@app.post("/labs/extract/")
async def extract_lab_report(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, f"temp_lab_{uuid.uuid4()}.pdf")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    data = lab_service.extract_from_pdf(file_path)
    os.remove(file_path)
    return data

# 17. SAVE LABS (UPDATED: Dr. House Trigger)
class LabEntry(BaseModel):
    test_name: str
    value: Union[str, int, float] 
    unit: str = ""
    status: str = "Normal"
    date: str = ""
 
class LabSaveRequest(BaseModel):
    patient_id: int
    results: List[LabEntry]

@app.post("/labs/save/")
def save_lab_results(req: LabSaveRequest):
    # 1. Save to DB
    results_dicts = [r.dict() for r in req.results]
    registry_service.save_lab_results(req.patient_id, results_dicts)
    
    # 2. Check for Abnormalities
    abnormal_labs = [r for r in req.results if "High" in r.status or "Low" in r.status or "Abnormal" in r.status]
    insight = ""
    
    if abnormal_labs:
        # 3. Call Dr. House
        insight = house_service.analyze_labs(abnormal_labs)
        
    return {"status": "saved", "insight": insight}

# 18. GET LABS
@app.get("/patients/{patient_id}/labs")
def get_patient_labs(patient_id: int):
    results = registry_service.get_patient_labs(patient_id)
    return results

# 19. GENERATE LAB PDF
@app.post("/labs/generate-report/")
def generate_lab_pdf(patient_id: int = Form(...)):
    patient = registry_service.get_patient(patient_id)
    if not patient: raise HTTPException(status_code=404, detail="Patient not found")
    history = registry_service.get_patient_labs(patient_id)
    pdf_path = report_service.generate_lab_report(patient.name, patient.age, history)
    return FileResponse(pdf_path, media_type='application/pdf', filename=f"Lab_Report_{patient.name}.pdf")

# 20. ANALYZE TREND
class TrendRequest(BaseModel):
    test_name: str
    history: list[dict]

@app.post("/labs/analyze-trend/")
def analyze_lab_trend(req: TrendRequest):
    summary = lab_service.analyze_trend(req.test_name, req.history)
    return {"summary": summary}

# 21. QUICK REPORT PDF
@app.post("/labs/quick-report/")
def generate_quick_report_pdf(results: List[LabEntry]):
    results_dicts = [r.dict() for r in results]
    class MockLab:
        def __init__(self, d):
            self.test_name = d['test_name']
            self.value = d['value']
            self.unit = d['unit']
            self.status = d['status']
            self.date = datetime.now()
    mock_history = [MockLab(d) for d in results_dicts]
    pdf_path = report_service.generate_lab_report("Quick Analysis (External)", 0, mock_history)
    return FileResponse(pdf_path, media_type='application/pdf', filename="Quick_Lab_Report.pdf")

# 22. ANALYZE FULL HISTORY (Dr. House Trigger)
@app.post("/labs/analyze-history/")
def analyze_history(patient_id: int = Form(...)):
    # 1. Fetch all historical data
    history = registry_service.get_patient_labs(patient_id)
    
    # 2. Filter for abnormalities (High/Low)
    abnormal_labs = [l for l in history if "High" in l.status or "Low" in l.status or "Abnormal" in l.status]
    
    insight = ""
    if abnormal_labs:
        # 3. Consult Dr. House
        insight = house_service.analyze_labs(abnormal_labs)
    else:
        insight = "No significant abnormalities detected in the patient's history."
        
    return {"insight": insight}

# 23. EXPORT PASSPORT (Updated for Stealth Mode)
@app.post("/passport/export/")
async def export_passport(
    patient_id: int = Form(...), 
    password: str = Form(...),
    hours: int = Form(24),
    carrier_image: Optional[UploadFile] = File(None) # <--- NEW OPTIONAL FILE
):
    if carrier_image:
        # STEALTH MODE
        temp_img_path = os.path.join(UPLOAD_DIR, carrier_image.filename)
        with open(temp_img_path, "wb") as buffer:
            shutil.copyfileobj(carrier_image.file, buffer)
            
        file_path = passport_service.generate_stealth_passport(patient_id, password, temp_img_path, hours)
        os.remove(temp_img_path)
    else:
        # STANDARD MODE
        file_path = passport_service.generate_passport(patient_id, password, hours)

    if not file_path:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    filename = os.path.basename(file_path)
    # Return as PNG if stealth, else binary
    media_type = 'image/png' if filename.endswith('.png') else 'application/octet-stream'
    
    return FileResponse(file_path, media_type=media_type, filename=filename)

# 24. IMPORT PASSPORT
@app.post("/passport/import/")
async def import_passport(file: UploadFile = File(...), password: str = Form(...)):
    # Save uploaded file temporarily
    temp_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    result = passport_service.import_passport(temp_path, password)
    os.remove(temp_path) # Cleanup
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return result

# 25. PEEK PASSPORT (Preview before Merge)
# 25. PEEK PASSPORT (Updated with AI Audit)
@app.post("/passport/peek/")
async def peek_passport(file: UploadFile = File(...), password: str = Form(...)):
    temp_path = os.path.join(UPLOAD_DIR, f"peek_{file.filename}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 1. Decrypt & Get Preview
    result = passport_service.preview_passport(temp_path, password)
    os.remove(temp_path)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    # 2. AI CUSTOMS OFFICER (Conflict Check)
    # Check if this patient exists locally by Name (fuzzy match or exact)
    # For MVP, we use exact name match from the registry
    all_patients = registry_service.get_all_patients()
    local_match = next((p for p in all_patients if p.name.lower() == result['name'].lower()), None)
    
    audit_report = None
    
    if local_match:
        # Fetch full local details for comparison
        full_local = registry_service.get_patient(local_match.id)
        
        # Prepare summaries
        local_summary = {
            "name": full_local.name,
            "history": full_local.medical_history,
            "latest_consult": full_local.consultations[-1].soap_note[:100] if full_local.consultations else "None"
        }
        
        incoming_summary = {
            "name": result['name'],
            "history": result['history_preview'], # We used 'history_preview' in passport.py, might need full history
            # Ideally passport.py's preview returns full history for audit, 
            # let's assume 'history_preview' is enough for now or adjust passport.py
            "latest_consult": "See full import"
        }
        
        # Call House
        import json
        audit_json = house_service.audit_passport(local_summary, incoming_summary)
        try:
            audit_report = json.loads(audit_json)
        except:
            audit_report = {"has_conflict": False, "note": "Audit parsing failed"}
            
    result["audit"] = audit_report
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)