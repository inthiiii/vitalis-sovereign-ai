import json
import base64
import os
import zlib
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from datetime import datetime, timedelta
from app.services.registry import registry_service

# MAGIC SIGNATURE to identify a Vitalis Payload inside an image
VITALIS_SIG = b"VITALIS_PAYLOAD_START"

class PassportService:
    def _get_key(self, password: str, salt: bytes) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(), length=32, salt=salt, iterations=100000,
        )
        return base64.urlsafe_b64encode(kdf.derive(password.encode()))

    # --- GENERATE PAYLOAD (Common logic) ---
    def _create_encrypted_blob(self, patient_id, password, hours_valid):
        patient = registry_service.get_patient(patient_id)
        if not patient: return None, None

        consults = [{"date": c.timestamp.strftime("%Y-%m-%d %H:%M:%S"), "soap": c.soap_note, "safety": c.safety_analysis} for c in patient.consultations]
        raw_labs = registry_service.get_patient_labs(patient_id)
        labs = [{"date": l.date.strftime("%Y-%m-%d"), "test": l.test_name, "val": l.value, "unit": l.unit, "status": l.status} for l in raw_labs]

        if hours_valid == -1: expiry_str = (datetime.now() + timedelta(days=36500)).isoformat()
        else: expiry_str = (datetime.now() + timedelta(hours=hours_valid)).isoformat()

        data = {
            "meta": {"app": "Vitalis", "version": "2.0", "type": "passport", "expires_at": expiry_str},
            "profile": {"name": patient.name, "age": patient.age, "history": patient.medical_history},
            "consultations": consults,
            "labs": labs
        }
        
        json_data = json.dumps(data).encode('utf-8')
        compressed_data = zlib.compress(json_data)

        salt = os.urandom(16)
        key = self._get_key(password, salt)
        f = Fernet(key)
        encrypted_data = f.encrypt(compressed_data)
        
        # Return the final blob (Salt + Data) and the patient name
        return salt + encrypted_data, patient.name

    # --- EXPORT STANDARD ---
    def generate_passport(self, patient_id: int, password: str, hours_valid: int = 24) -> str:
        blob, name = self._create_encrypted_blob(patient_id, password, hours_valid)
        if not blob: return None
        
        filename = f"Passport_{name.replace(' ', '_')}.vitalis"
        path = os.path.join("temp_uploads", filename)
        with open(path, "wb") as f: f.write(blob)
        return path

    # --- EXPORT STEALTH (STEGANOGRAPHY) ---
    def generate_stealth_passport(self, patient_id: int, password: str, image_path: str, hours_valid: int = 24) -> str:
        blob, name = self._create_encrypted_blob(patient_id, password, hours_valid)
        if not blob: return None

        # Read the Carrier Image
        with open(image_path, "rb") as img:
            image_data = img.read()

        # Combine: [Image Bytes] + [Signature] + [Encrypted Blob]
        stego_data = image_data + VITALIS_SIG + blob
        
        # Output as PNG (Stealth)
        filename = f"Stealth_{name.replace(' ', '_')}.png"
        output_path = os.path.join("temp_uploads", filename)
        with open(output_path, "wb") as f:
            f.write(stego_data)
            
        return output_path

    # --- IMPORT (Smart Detection) ---
    def import_passport(self, file_path: str, password: str):
        try:
            with open(file_path, "rb") as f:
                file_content = f.read()
            
            # CHECK FOR STEGANOGRAPHY
            if VITALIS_SIG in file_content:
                # Split at the signature. Take the part AFTER the signature.
                # If multiple signatures exist (rare), take the last one.
                parts = file_content.split(VITALIS_SIG)
                if len(parts) > 1:
                    print("🕵️‍♂️ Stealth Payload Detected!")
                    file_content = parts[-1] # The encrypted blob is at the end

            # Resume Standard Import
            salt = file_content[:16]
            encrypted_data = file_content[16:]
            
            key = self._get_key(password, salt)
            fernet = Fernet(key)
            compressed_data = fernet.decrypt(encrypted_data)
            
            try: json_data = zlib.decompress(compressed_data)
            except: json_data = compressed_data
            
            data = json.loads(json_data)
            
            # Check Time-Lock
            expires_at = data.get("meta", {}).get("expires_at")
            if expires_at:
                expiry_dt = datetime.fromisoformat(expires_at)
                if datetime.now() > expiry_dt:
                    return {"error": "PASSPORT EXPIRED. Access Denied."}

            # Merge to DB
            p_data = data["profile"]
            new_p = registry_service.create_patient(f"{p_data['name']} (Imported)", p_data['age'], p_data['history'])
            
            for c in data.get("consultations", []):
                registry_service.save_consultation(new_p.id, c['soap'], c['safety'])
                
            restored_labs = []
            for l in data.get("labs", []):
                restored_labs.append({"test_name": l["test"], "value": l["val"], "unit": l["unit"], "status": l["status"], "date": l["date"]})
            if restored_labs:
                registry_service.save_lab_results(new_p.id, restored_labs)
                
            return {"status": "success", "name": new_p.name}
            
        except Exception as e:
            print(f"Import Error: {e}")
            return {"error": "Decryption Failed or Invalid File"}

        # --- PEEK / PREVIEW (No Database Write) ---
    def preview_passport(self, file_path: str, password: str):
        try:
            with open(file_path, "rb") as f:
                file_content = f.read()
            
            # 1. Check for Stealth Signature
            if VITALIS_SIG in file_content:
                parts = file_content.split(VITALIS_SIG)
                if len(parts) > 1: file_content = parts[-1]

            # 2. Extract Salt & Data
            salt = file_content[:16]
            encrypted_data = file_content[16:]
            
            # 3. Decrypt
            key = self._get_key(password, salt)
            fernet = Fernet(key)
            compressed_data = fernet.decrypt(encrypted_data)
            
            try: json_data = zlib.decompress(compressed_data)
            except: json_data = compressed_data
            
            data = json.loads(json_data)
            
            # 4. Check Time-Lock
            status = "Valid"
            expires_at = data.get("meta", {}).get("expires_at")
            if expires_at:
                expiry_dt = datetime.fromisoformat(expires_at)
                if datetime.now() > expiry_dt:
                    status = "EXPIRED"

            # 5. Return Summary Data (Do NOT save to DB)
            summary = {
                "status": status,
                "name": data["profile"]["name"],
                "age": data["profile"]["age"],
                "history_preview": data["profile"]["history"][:100] + "...",
                "consult_count": len(data.get("consultations", [])),
                "lab_count": len(data.get("labs", [])),
                "meta": data.get("meta", {})
            }
            return summary
            
        except Exception as e:
            print(f"Peek Error: {e}")
            return {"error": "Invalid Password or Corrupt File"}

passport_service = PassportService()