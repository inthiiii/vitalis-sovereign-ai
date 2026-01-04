from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

Base = declarative_base()

class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    age = Column(Integer)
    medical_history = Column(String)
    
    # Relationships
    consultations = relationship("Consultation", back_populates="patient", cascade="all, delete-orphan")
    lab_results = relationship("LabResult", back_populates="patient", cascade="all, delete-orphan")

class Consultation(Base):
    __tablename__ = "consultations"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    timestamp = Column(DateTime, default=datetime.now)
    soap_note = Column(String)
    safety_analysis = Column(String)
    
    patient = relationship("Patient", back_populates="consultations")

# NEW: LAB RESULT TABLE
class LabResult(Base):
    __tablename__ = "lab_results"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    date = Column(DateTime, default=datetime.now)
    test_name = Column(String) # e.g. "Hemoglobin"
    value = Column(String)     # e.g. "13.5"
    unit = Column(String)      # e.g. "g/dL"
    status = Column(String)    # "Normal", "High", "Low"
    
    patient = relationship("Patient", back_populates="lab_results")

# Setup DB
engine = create_engine("sqlite:///./vitalis.db", connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class RegistryService:
    def __init__(self):
        self.db = SessionLocal()

    def get_all_patients(self):
        return self.db.query(Patient).all()

    def create_patient(self, name, age, history):
        p = Patient(name=name, age=age, medical_history=history)
        self.db.add(p)
        self.db.commit()
        self.db.refresh(p)
        return p

    def get_patient(self, pid):
        return self.db.query(Patient).filter(Patient.id == pid).first()

    def save_consultation(self, pid, soap, safety):
        c = Consultation(patient_id=pid, soap_note=soap, safety_analysis=safety)
        self.db.add(c)
        self.db.commit()

    # SAVE LABS
    def save_lab_results(self, pid, results_list):
        for r in results_list:
            # Parse the extracted date string (which is now guaranteed to be YYYY-MM-DD or today)
            date_str = r.get('date', datetime.now().strftime("%Y-%m-%d"))
            try:
                entry_date = datetime.strptime(date_str, "%Y-%m-%d")
            except:
                entry_date = datetime.now()

            lab = LabResult(
                patient_id=pid,
                date=entry_date, # <--- THIS IS CRITICAL
                test_name=r.get('test_name', 'Unknown'),
                value=str(r.get('value', '0')),
                unit=r.get('unit', ''),
                status=r.get('status', 'Normal')
            )
            self.db.add(lab)
        self.db.commit()

    def get_patient_labs(self, pid):
        return self.db.query(LabResult).filter(LabResult.patient_id == pid).order_by(LabResult.date).all()

registry_service = RegistryService()