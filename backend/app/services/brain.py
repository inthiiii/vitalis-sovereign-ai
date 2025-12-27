import ollama

class BrainService:
    def __init__(self, model="llama3.2"):
        self.model = model

    def generate_soap_note(self, transcript: str):
        print(f"Thinking with {self.model}...")
        
        prompt = f"""
        You are an expert medical scribe.
        
        INPUT DATA:
        "{transcript}"

        INSTRUCTIONS:
        1. Analyze Audio and Visual findings.
        2. Visual findings must go into **OBJECTIVE**.
        3. Do not order tests that are already visible (e.g. don't order X-Ray if one is provided).
        
        FORMATTING RULES:
        - Use the standard SOAP format (Subjective, Objective, Assessment, Plan).
        - **DO NOT include conversational filler.**
        - **DO NOT add a "Note:" or explanation at the end.**
        - **Output ONLY the SOAP note content.**
        """

        response = ollama.chat(model=self.model, messages=[
            {'role': 'user', 'content': prompt},
        ])
        
        return response['message']['content']

# Initialize the Brain
brain_service = BrainService()