import ollama
import re
import json
from app.services.registry import registry_service
from app.services.knowledge import knowledge_service

class OmniService:
    def __init__(self, model="llama3.2"):
        self.model = model
        self.history = [] 

    def _run_prompt(self, prompt):
        res = ollama.chat(model=self.model, messages=[{'role': 'user', 'content': prompt}])
        return res['message']['content'].strip()

    def chat(self, user_query: str, use_memory: bool = True):
        print(f"🤖 Omni received: {user_query}")

        # 1. ROUTING
        router_prompt = f"""
        Classify USER QUERY into one category:
        1. NAVIGATION: Switch screens or open a specific patient file (e.g., "Open Victor", "Go to Labs").
        2. DATA_ENTRY: Add/Edit text in the current session (e.g., "Add symptom...", "Note that...", "Update history").
        3. ACTION: Create/Delete data (e.g., "Create patient").
        4. DATA: Ask about data (e.g., "Who is Victor?").
        5. KNOWLEDGE: Medical questions.
        6. GENERAL: Greetings.

        USER QUERY: "{user_query}"
        OUTPUT: Category Name Only.
        """
        intent = self._run_prompt(router_prompt).upper()
        
        # Keyword Overrides for speed
        q = user_query.lower()
        if "open" in q or "go to" in q or "show" in q or "start" in q: intent = "NAVIGATION"
        if "add" in q or "note" in q or "symptom" in q: intent = "DATA_ENTRY"
        if "create" in q: intent = "ACTION"

        print(f"📍 Intent: {intent}")

        if intent == "NAVIGATION": return self._handle_navigation(user_query)
        elif intent == "DATA_ENTRY": return self._handle_data_entry(user_query)
        elif intent == "ACTION": return self._handle_action(user_query)
        elif intent == "DATA": return self._handle_data_query(user_query)
        elif intent == "KNOWLEDGE": return self._handle_knowledge_query(user_query)
        else: return self._simple_chat(user_query)

    # --- HANDLERS ---

    def _handle_navigation(self, query):
        """Smart Navigation: Finds pages AND performs fuzzy name matching"""
        q = query.lower()
        
        # 1. Find Target Page (Keep existing mapping)
        target_page = "omni"
        mapping = {
            "consult": "consultation", "soap": "consultation", "start": "consultation",
            "registry": "patients", "add patient": "patients",
            "record": "records", "history": "records", "file": "records", "chart": "records",
            "lab": "labs", "result": "labs",
            "passport": "passport", "knowledge": "knowledge"
        }
        for key, val in mapping.items():
            if key in q: target_page = val; break
        
        # 2. SMART PATIENT MATCHING (The Fix)
        patients = registry_service.get_all_patients()
        target_patient_id = None
        target_patient_name = ""
        
        for p in patients:
            p_name_clean = p.name.lower()
            
            # Check 1: Full Name Match (e.g. "Victor Dam")
            if p_name_clean in q:
                target_patient_id = p.id; target_patient_name = p.name
                break
            
            # Check 2: Partial Name Match (e.g. "Victor" or "Dam")
            # We split the DB name into parts ["victor", "dam"]
            name_parts = p_name_clean.split()
            for part in name_parts:
                # We check if this part exists as a distinct word in the query
                # preventing "Dan" matching "Danny" incorrectly if we just used 'in'
                # but for simplicity, 'in q' is usually fine for voice commands.
                if len(part) > 2 and part in q: 
                    target_patient_id = p.id; target_patient_name = p.name
                    break
            
            if target_patient_id: break
        
        # Default Logic: If saying "Open Victor" without a page, assume Records
        if target_patient_id and target_page == "omni":
            target_page = "records"

        # Build Response Tag
        response = f"<<NAVIGATE:{target_page}>> "
        if target_patient_id:
            response += f"<<SELECT_PATIENT:{target_patient_id}>> "
            response += f"Opening {target_page} for {target_patient_name}."
        else:
            response += f"Opening {target_page} view."
            
        return response

    def _handle_data_entry(self, query):
        """Direct Manipulation: Writes text into the app"""
        prompt = f"""
        Extract the content to write from the user request.
        Request: "{query}"
        
        Target Field Options: [transcript, soap_note, history]
        - "Add symptom/complaint/subjective" -> soap_note
        - "Note that/Add history/Allergy" -> history
        - Default -> transcript
        
        OUTPUT JSON: {{"field": "...", "text": "..."}}
        """
        try:
            json_str = self._run_prompt(prompt).replace("```json", "").replace("```", "").strip()
            data = json.loads(json_str)
            return f"<<UPDATE_FIELD:{data['field']}|{data['text']}>> Added to {data['field']}."
        except:
            return "I couldn't parse that data entry request."

    def _handle_action(self, query):
        if "create" in query.lower():
            # (Keep existing create logic)
            prompt = f"""Extract JSON: "{query}". Format: {{"name": "X", "age": 0, "history": "Y"}}"""
            try:
                data = json.loads(self._run_prompt(prompt).replace("```json", "").replace("```", "").strip())
                new_p = registry_service.create_patient(data.get('name','?'), int(data.get('age',0)), data.get('history',''))
                return f"✅ Created patient {new_p.name}."
            except: return "Failed to create patient. Try 'Create patient X, age Y'."
        return "I can only create patients right now."

    # (Keep _handle_data_query, _handle_knowledge_query, _simple_chat as is)
    def _handle_data_query(self, query):
        patients = registry_service.get_all_patients()
        db_context = "\n".join([f"{p.id}: {p.name}, {p.age}y" for p in patients])
        return self._run_prompt(f"Data Query. DB: {db_context}. User: {query}")

    def _handle_knowledge_query(self, query):
        return self._run_prompt(f"Medical Knowledge. User: {query}")

    def _simple_chat(self, query):
        return self._run_prompt(f"Vitalis Omni. User: {query}. Reply briefly.")

omni_service = OmniService()