import ollama

class HouseAgent:
    def __init__(self, model="llama3.2"):
        self.model = model

    def get_second_opinion(self, soap_note: str):
        if len(soap_note) < 50:
            return "⚠️ Insufficient clinical data for analysis."

        print("🤔 Clinical Review Board is analyzing...")
        
        prompt = f"""
        You are a Clinical Diagnostic Algorithm.
        
        INPUT DATA:
        "{soap_note}"

        TASK:
        List 3 differential diagnoses based strictly on the symptoms in the Input Data.
        
        RULES:
        - Do NOT hallucinate symptoms not present in the text.
        - If text says "Fracture", suggest "Compartment Syndrome".
        - If text says "Fever/Confusion", suggest "Meningitis" or "Sepsis".
        
        OUTPUT FORMAT:
        **1. [Diagnosis]:** [Reasoning]
        **2. [Diagnosis]:** [Reasoning]
        **3. [Diagnosis]:** [Reasoning]
        """

        response = ollama.chat(model=self.model, messages=[
            {'role': 'user', 'content': prompt},
        ])
        
        return response['message']['content']

    # --- NEW: LAB ANALYSIS BRIDGE ---
    def analyze_labs(self, abnormal_labs):
        # abnormal_labs is a list of dicts: [{'test_name': 'Iron', 'value': 'Low', ...}]
        print("🤔 Dr. House is reviewing lab abnormalities...")
        
        lab_str = "\n".join([f"- {l.test_name}: {l.value} ({l.status})" for l in abnormal_labs])
        
        prompt = f"""
        You are an Expert Diagnostic Pathologist.
        
        ABNORMAL LAB FINDINGS:
        {lab_str}
        
        TASK:
        Provide a concise (2-3 sentences) clinical insight connecting these specific abnormalities. 
        What pathology connects these dots?
        
        EXAMPLES:
        - If Low Iron + Low MCV -> "Suggests Iron Deficiency Anemia."
        - If High Calcium + High PTH -> "Pattern consistent with Hyperparathyroidism."
        - If High Glucose + High HbA1c -> "Indicates uncontrolled Diabetes Mellitus."
        
        OUTPUT:
        Direct clinical insight only. No "Here is the analysis" fluff.
        """

        response = ollama.chat(model=self.model, messages=[
            {'role': 'user', 'content': prompt},
        ])
        
        return response['message']['content']

    # --- NEW: PASSPORT CONFLICT AUDITOR ---
    def audit_passport(self, local_data, incoming_data):
        print("🛃 AI Customs Officer inspecting passport...")
        
        prompt = f"""
        You are a Medical Data Auditor. Compare the Local Record vs Incoming Passport.
        
        LOCAL RECORD:
        Name: {local_data['name']}
        History: {local_data['history']}
        Latest Vital: {local_data.get('latest_consult', 'N/A')}
        
        INCOMING PASSPORT:
        Name: {incoming_data['name']}
        History: {incoming_data['history']}
        Latest Vital: {incoming_data.get('latest_consult', 'N/A')}
        
        TASK:
        Identify MEDICALLY SIGNIFICANT conflicts.
        - Ignore minor spelling/formatting.
        - Flag missing allergies, conflicting diagnoses, or major history gaps.
        
        OUTPUT FORMAT (JSON):
        {{
            "has_conflict": true,
            "severity": "High" or "Low",
            "warnings": ["Warning 1", "Warning 2"],
            "recommendation": "Merge Carefully" or "Safe to Merge"
        }}
        """

        try:
            response = ollama.chat(model=self.model, messages=[
                {'role': 'system', 'content': 'You are a JSON conflict detector. Output ONLY valid JSON.'},
                {'role': 'user', 'content': prompt}
            ])
            
            # Clean and parse
            content = response['message']['content'].replace("```json", "").replace("```", "").strip()
            return content # Return raw string to be parsed by caller, or parse here
        except Exception as e:
            return f'{{"has_conflict": false, "error": "{str(e)}"}}'

house_service = HouseAgent()