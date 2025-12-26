import ollama

class PharmacistAgent:
    def __init__(self, model="llama3.2"):
        self.model = model

    def check_safety(self, soap_note: str, patient_history: str):
        print("💊 Pharmacist Agent is reviewing the plan...")
        
        prompt = f"""
        You are an AI Pharmacist and Safety Auditor.
        
        INPUTS:
        1. Patient Medical History: "{patient_history}"
        2. Proposed Treatment Plan (from SOAP Note): "{soap_note}"

        TASK:
        Compare the medications in the PLAN against the Patient History.

        CRITICAL OUTPUT RULES:
        - If the patient is allergic to a prescribed drug (e.g. Penicillin vs Amoxicillin), you MUST start your response with "WARNING:".
        - If there is a dangerous interaction, you MUST start with "WARNING:".
        - If the plan is safe, start with "SAFE:".
        
        Examples:
        - "WARNING: Patient is allergic to Penicillin and Amoxicillin was prescribed."
        - "SAFE: No contraindications detected."
        
        Do not be vague. Start with either WARNING or SAFE.
        """

        response = ollama.chat(model=self.model, messages=[
            {'role': 'user', 'content': prompt},
        ])
        
        return response['message']['content']

pharmacist_service = PharmacistAgent()