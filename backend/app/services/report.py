from fpdf import FPDF
import os

class ReportService:
    def generate_report(self, patient_name, patient_age, soap_note, safety_analysis):
        pdf = FPDF()
        pdf.add_page()
        
        # 1. Header
        pdf.set_font("Arial", "B", 16)
        pdf.cell(0, 10, "Vitalis | Sovereign Medical Record", ln=True, align="C")
        pdf.ln(10)
        
        # 2. Patient Info
        pdf.set_font("Arial", "B", 12)
        pdf.cell(0, 10, f"Patient Name: {patient_name}", ln=True)
        pdf.cell(0, 10, f"Age: {patient_age}", ln=True)
        pdf.line(10, 45, 200, 45) # Horizontal line
        pdf.ln(10)
        
        # 3. Safety Alert Section (If Warning)
        if "WARNING" in safety_analysis:
            pdf.set_text_color(200, 0, 0) # Red
            pdf.cell(0, 10, "SAFETY ALERT:", ln=True)
            pdf.set_font("Arial", "", 11)
            pdf.multi_cell(0, 10, safety_analysis)
            pdf.set_text_color(0, 0, 0) # Reset to Black
            pdf.ln(5)
        else:
            pdf.set_text_color(0, 100, 0) # Green
            pdf.cell(0, 10, "Safety Check Passed", ln=True)
            pdf.set_text_color(0, 0, 0)
            pdf.ln(5)

        # 4. The SOAP Note
        pdf.set_font("Arial", "B", 14)
        pdf.cell(0, 10, "Consultation Notes (SOAP)", ln=True)
        pdf.ln(5)
        
        pdf.set_font("Arial", "", 11)
        # Handle unicode roughly by replacing typical issues or using a compatible font
        # For simplicity in this demo, we encode/decode to basic latin
        clean_note = soap_note.encode('latin-1', 'replace').decode('latin-1')
        pdf.multi_cell(0, 8, clean_note)
        
        # 5. Save Logic
        output_dir = "reports"
        os.makedirs(output_dir, exist_ok=True)
        filename = f"{output_dir}/Report_{patient_name.replace(' ', '_')}.pdf"
        pdf.output(filename)
        
        return filename

report_service = ReportService()