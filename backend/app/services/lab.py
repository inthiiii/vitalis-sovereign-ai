import ollama
import json
from datetime import datetime
from langchain_community.document_loaders import PyPDFLoader

class LabExtractor:
    def __init__(self, model="llama3.2"):
        self.model = model

    def normalize_units(self, data):
        """
        The Universal Translator: Standardizes units for consistent graphing.
        """
        for item in data:
            try:
                name = item.get('test_name', '').lower()
                val_str = str(item.get('value', '0')).replace(',', '')
                # Extract numeric part if string contains chars
                import re
                numeric_part = re.search(r"[-+]?\d*\.\d+|\d+", val_str)
                if not numeric_part: continue
                
                val = float(numeric_part.group())
                unit = item.get('unit', '').lower()

                # Rule 1: Hemoglobin (Convert g/L -> g/dL)
                # If value is > 50 (e.g. 145), it's likely g/L. Divide by 10.
                if ('hemoglobin' in name or 'hgb' in name) and val > 50:
                    item['value'] = str(round(val / 10, 1))
                    item['unit'] = 'g/dL'
                    print(f"📏 Normalized {name}: {val} -> {item['value']} g/dL")

                # Rule 2: Glucose (Convert mmol/L -> mg/dL)
                # 1 mmol/L = 18 mg/dL
                if 'glucose' in name and 'mmol' in unit:
                    item['value'] = str(int(val * 18))
                    item['unit'] = 'mg/dL'
                    print(f"📏 Normalized {name}: {val} -> {item['value']} mg/dL")
                
                # Rule 3: Creatinine (Convert umol/L -> mg/dL)
                # 1 mg/dL = 88.4 umol/L
                if 'creatinine' in name and ('umol' in unit or 'µmol' in unit):
                    item['value'] = str(round(val / 88.4, 2))
                    item['unit'] = 'mg/dL'
                    print(f"📏 Normalized {name}: {val} -> {item['value']} mg/dL")

            except Exception as e:
                print(f"⚠️ Normalization error for {item}: {e}")
                continue
        return data

    def extract_from_pdf(self, file_path: str):
        print("🩸 Analyzing Lab Report...")
        
        try:
            loader = PyPDFLoader(file_path)
            pages = loader.load()
            text_content = "\n".join([p.page_content for p in pages])
            
            # Check if PDF text is empty (Scanned PDF issue)
            if len(text_content.strip()) < 10:
                print("⚠️ Warning: PDF extracted text is empty. It might be a scanned image.")
                return []
                
        except Exception as e:
            return [{"test_name": "Error", "value": "0", "unit": "N/A", "status": str(e), "date": datetime.now().strftime("%Y-%m-%d")}]

        prompt = f"""
        You are a Data Scraper. Your job is to COPY text from the document exactly.
        
        DOCUMENT TEXT:
        "{text_content[:3000]}"
        
        INSTRUCTIONS:
        1. **SCAN FOR DATE:** Look for "Collection Date", "Report Date", or "Date" in the header.
           - Extract the date EXACTLY as it appears.
           - If NO date is found, write "TODAY".
        2. Find the Lab Results Table.
        3. Extract each row into a JSON object.
        4. **CRITICAL:** Look for a column named "Flag", "Status", or "Reference". 
           - IF the document explicitly says "High", "Low", or "H", "L" -> Use that status.
           - IF the document says "Normal" or is blank -> Use "Normal".
        
        OUTPUT FORMAT (Strict JSON Array):
        [
            {{"test_name": "Test Name", "value": "Value", "unit": "Unit", "status": "Status", "date": "Raw Date String"}}
        ]
        """

        response = ollama.chat(model=self.model, messages=[
            {'role': 'system', 'content': 'You are a robotic data scraper. You output valid JSON only. Do not write Note or Explanation.'},
            {'role': 'user', 'content': prompt}
        ])
        
        content = response['message']['content']
        
        try:
            # --- FIX: ROBUST JSON EXTRACTION ---
            # Find the first '[' and the last ']' to ignore any "Here is the JSON" text
            import re
            json_match = re.search(r"\[.*\]", content, re.DOTALL)
            
            if json_match:
                clean_json = json_match.group(0)
            else:
                print(f"❌ No JSON array found in LLM response: {content}")
                return []

            data = json.loads(clean_json)
            
            # Date & Unit Logic (Keep existing)
            today_str = datetime.now().strftime("%Y-%m-%d")
            for item in data:
                item['value'] = str(item.get('value', '0'))
                raw_date = item.get('date', 'TODAY')
                if raw_date.upper() == 'TODAY':
                    item['date'] = today_str
                else:
                    try:
                        parsed_date = None
                        for fmt in ("%b %d, %Y", "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y", "%d-%b-%Y"):
                            try:
                                parsed_date = datetime.strptime(raw_date, fmt)
                                break
                            except ValueError: continue
                        if parsed_date: item['date'] = parsed_date.strftime("%Y-%m-%d")
                        else: item['date'] = today_str
                    except: item['date'] = today_str
            
            # Apply Unit Normalization
            data = self.normalize_units(data)
            return data

        except Exception as e:
            print(f"❌ JSON Parse Error: {e}")
            print(f"⚠️ Raw Output from AI: {content}") # Inspect this in terminal to see what went wrong
            return []

    def analyze_trend(self, test_name, history_data):
        print(f"📈 Analyzing trend for {test_name}...")
        data_str = "\n".join([f"{d['date']}: {d['value']}" for d in history_data])
        prompt = f"""You are a Medical Trend Analyst. TEST: {test_name}. DATA: {data_str}. TASK: Write 2 sentences on the trajectory. Is it improving or worsening?"""
        response = ollama.chat(model=self.model, messages=[{'role': 'user', 'content': prompt}])
        return response['message']['content']

lab_service = LabExtractor()