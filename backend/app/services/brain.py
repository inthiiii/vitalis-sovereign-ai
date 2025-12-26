import ollama

class BrainService:
    def __init__(self, model="llama3.2"):
        self.model = model

    def generate_soap_note(self, transcript: str):
        print(f"Thinking with {self.model}...")
        
        prompt = f"""
        You are an expert medical scribe assisting a doctor. 
        Your task is to convert the following raw consultation transcript into a professional medical SOAP Note.

        RAW TRANSCRIPT:
        "{transcript}"

        INSTRUCTIONS:
        1. Extract relevant medical information only.
        2. Format strictly as follows:
           - **SUBJECTIVE:** (Patient's chief complaint, history of present illness, symptoms)
           - **OBJECTIVE:** (Vital signs, physical exam findings, lab results mentioned)
           - **ASSESSMENT:** (Diagnosis or differential diagnoses)
           - **PLAN:** (Medications, treatment instructions, follow-up)
        3. Be concise and professional. Do not add conversational filler.
        """

        response = ollama.chat(model=self.model, messages=[
            {'role': 'user', 'content': prompt},
        ])
        
        return response['message']['content']

# Initialize the Brain
brain_service = BrainService()