import ollama

class PharmacistAgent:
    def __init__(self, model="llama3.2"):
        self.model = model

    def check_safety(self, soap_note: str, patient_history: str):
        print("💊 Pharmacist Agent is reviewing the plan...")
        
        prompt = f"""
        You are an AI Pharmacist.
        
        INPUTS:
        1. History: "{patient_history}"
        2. Plan: "{soap_note}"

        CRITICAL RULES:
        1. ONLY analyze drugs explicitly mentioned in the "Plan". DO NOT assume or hallucinate drugs that are not written there.
        2. If the Plan is empty or generic (e.g., "Rest", "Follow up"), return "SAFE: No medications prescribed."
        3. If a drug IS mentioned, check it against the History for allergies/interactions.
        
        OUTPUT FORMAT:
        - Start with "WARNING:" only if a clear danger exists.
        - Start with "SAFE:" otherwise.
        """

        response = ollama.chat(model=self.model, messages=[
            {'role': 'user', 'content': prompt},
        ])
        
        return response['message']['content']

pharmacist_service = PharmacistAgent()