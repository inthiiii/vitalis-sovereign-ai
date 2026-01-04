import ollama

class PharmacistAgent:
    def __init__(self, model="llama3.2"):
        self.model = model

    def check_safety(self, soap_note: str, patient_history: str):
        # Sanity Check
        if "Clinical Review Required" in soap_note or len(soap_note) < 20:
             return "SAFE: No plan generated yet."

        print("💊 Pharmacist Agent is reviewing the plan...")
        
        prompt = f"""
        You are a Toxicology Safety Engine.
        
        PATIENT HISTORY: "{patient_history}"
        PROPOSED PLAN: "{soap_note}"

        TASK:
        1. List all medications found in the "PROPOSED PLAN".
        2. Check that list against "PATIENT HISTORY" for allergies.
        
        RULES:
        - IF Plan has "Vancomycin" AND History has "Allergy to Vancomycin" -> WARNING: Patient is allergic to Vancomycin.
        - IF Plan has "MagicPill" -> WARNING: Experimental Protocol.
        - IF Plan has NO drugs -> SAFE: No medications prescribed.
        - IF Drugs exist but NO allergies match -> SAFE: Standard protocol approved.

        OUTPUT FORMAT (Single Sentence):
        WARNING: [Reason]
        OR
        SAFE: [Reason]
        """

        response = ollama.chat(model=self.model, messages=[
            {'role': 'user', 'content': prompt},
        ])
        
        raw = response['message']['content'].strip()
        
        # Cleanup
        if "WARNING" in raw.upper():
            return "WARNING:" + raw.split("WARNING")[1].split(".")[0].lstrip(":").strip() + "."
        return "SAFE: No critical risks detected."

pharmacist_service = PharmacistAgent()