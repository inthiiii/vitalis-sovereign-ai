import ollama
import json
from app.services.knowledge import knowledge_service

class BrainService:
    def __init__(self, model="llama3.2"):
        self.model = model

    def generate_soap_note(self, transcript: str, use_rag: bool = True):
        print(f"Thinking with {self.model}... (RAG: {use_rag})")
        
        # 1. Split Vision/Audio (Do this FIRST)
        visual_section = "None"
        audio_section = transcript
        
        marker = "VISUAL FINDINGS FROM IMAGE:"
        if marker in transcript:
            parts = transcript.split(marker)
            audio_section = parts[0].replace("AUDIO TRANSCRIPT:", "").strip()
            if len(parts) > 1 and len(parts[1].strip()) > 5:
                visual_section = parts[1].strip()

        # 2. Search Knowledge (Respect the Toggle)
        research_context = "No knowledge base provided."
        if use_rag:
            # Only search if toggle is ON
            research_context = knowledge_service.search_knowledge(audio_section[:500])
        
        # 3. The "Strict" Prompt (No Hallucination Examples)
        prompt = f"""
        You are a Clinical Data Parser. Your goal is strict fidelity to the input.
        
        INPUT DATA:
        - Patient Complaint: "{audio_section}"
        - Visual Evidence: "{visual_section}"
        - Protocol Library: "{research_context}"

        INSTRUCTIONS:
        1. **Subjective:** Summarize the Patient Complaint.
        2. **Objective:**
           - IF "Visual Evidence" is "None" -> Write "None".
           - IF "Visual Evidence" contains text -> Summarize it here.
        3. **Assessment:** Diagnosis based ONLY on the provided Audio/Visuals.
        4. **Plan:** - CHECK: Does the "Protocol Library" match the Assessment?
             - YES -> Extract the steps exactly.
             - NO (or if Protocol is "No knowledge base provided") -> Write a standard medical plan based on the Assessment.

        OUTPUT FORMAT (JSON):
        Return ONLY valid JSON with keys: "subjective", "objective", "assessment", "plan".
        """

        response = ollama.chat(model=self.model, messages=[
            {'role': 'system', 'content': 'You are a JSON parser. Output only raw JSON.'},
            {'role': 'user', 'content': prompt},
        ])
        
        content = response['message']['content']
        clean_content = content.replace("```json", "").replace("```", "").strip()
        
        try:
            data = json.loads(clean_content)
            return f"""Subjective: {data.get('subjective')}
Objective: {data.get('objective')}
Assessment: {data.get('assessment')}
Plan: {data.get('plan')}"""
        except:
            # Fallback if JSON fails (rare)
            return f"Subjective: {audio_section}\nObjective: {visual_section}\nAssessment: Assessment Pending\nPlan: Clinical Review Required"

brain_service = BrainService()