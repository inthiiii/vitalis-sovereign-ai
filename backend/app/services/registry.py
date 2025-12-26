from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import json

# 1. Setup Database
DATABASE_URL = "sqlite:///./vitalis.db"
Base = declarative_base()
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 2. Define Models
class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    age = Column(Integer)
    medical_history = Column(Text)
    # Relationship to Consultations
    consultations = relationship("Consultation", back_populates="patient")

class Consultation(Base):
    __tablename__ = "consultations"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    soap_note = Column(Text)
    safety_analysis = Column(Text)
    
    patient = relationship("Patient", back_populates="consultations")

# 3. Create Tables
Base.metadata.create_all(bind=engine)

# 4. The Registry Manager
class PatientRegistry:
    def __init__(self):
        self.db = SessionLocal()
        # Seed only if empty
        if self.db.query(Patient).count() == 0:
            self.seed_db()

    def seed_db(self):
        # We keep the seed for initial testing, but now users can add their own
        p1 = Patient(name="Mark Doe", age=45, medical_history="Asthma. SEVERE ALLERGY TO PENICILLIN.")
        p2 = Patient(name="Jane Smith", age=29, medical_history="Healthy. No allergies.")
        self.db.add_all([p1, p2])
        self.db.commit()

    def get_all_patients(self):
        return self.db.query(Patient).all()

    def get_patient(self, patient_id: int):
        return self.db.query(Patient).filter(Patient.id == patient_id).first()

    # --- NEW: ADD PATIENT ---
    def create_patient(self, name, age, history):
        new_patient = Patient(name=name, age=age, medical_history=history)
        self.db.add(new_patient)
        self.db.commit()
        self.db.refresh(new_patient)
        return new_patient

    # --- NEW: SAVE CONSULTATION ---
    def save_consultation(self, patient_id, soap_note, safety_analysis):
        consultation = Consultation(
            patient_id=patient_id,
            soap_note=soap_note,
            safety_analysis=safety_analysis
        )
        self.db.add(consultation)
        self.db.commit()

registry_service = PatientRegistry()