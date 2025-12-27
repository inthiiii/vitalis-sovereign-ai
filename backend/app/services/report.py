from fpdf import FPDF
import os
from datetime import datetime

class VitalisPDF(FPDF):
    def header(self):
        # Logo or Brand Name
        self.set_font('Arial', 'B', 15)
        self.set_text_color(16, 185, 129) # Emerald Green (Vitalis Brand)
        self.cell(80)
        self.cell(30, 10, 'VITALIS', 0, 0, 'C')
        self.ln(5)
        
        # Subtitle
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128, 128, 128) # Grey
        self.cell(0, 10, 'Sovereign Medical Intelligence Platform', 0, 0, 'C')
        self.ln(20) # Line break

    def footer(self):
        # Position at 1.5 cm from bottom
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128, 128, 128)
        # Page number and Confidentiality
        self.cell(0, 10, f'Page {self.page_no()} | CONFIDENTIAL MEDICAL RECORD | Generated via Local AI', 0, 0, 'C')

    def chapter_title(self, label):
        self.set_font('Arial', 'B', 12)
        self.set_fill_color(240, 240, 240) # Light Grey
        self.set_text_color(0, 0, 0)
        self.cell(0, 10, f'  {label}', 0, 1, 'L', 1)
        self.ln(4)

    def chapter_body(self, text):
        self.set_font('Arial', '', 11)
        self.multi_cell(0, 6, text)
        self.ln()

class ReportService:
    def generate_report(self, patient_name, patient_age, soap_note, safety_analysis, timestamp=None):
        pdf = VitalisPDF()
        pdf.add_page()
        
        # 1. Patient Info Grid
        pdf.set_font("Arial", "", 10)
        date_str = timestamp.strftime("%Y-%m-%d %H:%M") if timestamp else datetime.now().strftime("%Y-%m-%d %H:%M")
        
        # Draw a box for details
        pdf.set_draw_color(200, 200, 200)
        pdf.rect(10, 35, 190, 25)
        
        pdf.set_xy(15, 40)
        pdf.set_font("Arial", "B", 10)
        pdf.cell(30, 5, "Patient Name:")
        pdf.set_font("Arial", "", 10)
        pdf.cell(50, 5, patient_name)
        
        pdf.set_font("Arial", "B", 10)
        pdf.cell(20, 5, "Date:")
        pdf.set_font("Arial", "", 10)
        pdf.cell(40, 5, date_str)
        pdf.ln(8)
        
        pdf.set_x(15)
        pdf.set_font("Arial", "B", 10)
        pdf.cell(30, 5, "Patient Age:")
        pdf.set_font("Arial", "", 10)
        pdf.cell(50, 5, str(patient_age))
        
        pdf.ln(20) # Move down below box

        # 2. Safety Status Banner
        if "WARNING" in safety_analysis:
            pdf.set_fill_color(254, 226, 226) # Light Red Background
            pdf.set_text_color(185, 28, 28)   # Dark Red Text
            pdf.set_draw_color(185, 28, 28)   # Red Border
            header_text = " SAFETY ALERT DETECTED"
        else:
            pdf.set_fill_color(209, 250, 229) # Light Green Background
            pdf.set_text_color(4, 120, 87)    # Dark Green Text
            pdf.set_draw_color(4, 120, 87)    # Green Border
            header_text = " SAFETY CHECK PASSED"
            
        pdf.set_font('Arial', 'B', 12)
        pdf.cell(0, 12, header_text, 1, 1, 'L', 1)
        
        # Safety Analysis Text
        pdf.set_text_color(50, 50, 50)
        pdf.set_font('Arial', '', 10)
        pdf.multi_cell(0, 6, safety_analysis)
        pdf.ln(10)

        # 3. SOAP Note
        # We need to clean unicode characters that fpdf hates (like Markdown stars)
        clean_note = soap_note.replace('**', '').replace('#', '')
        # Ensure latin-1 compatible
        clean_note = clean_note.encode('latin-1', 'replace').decode('latin-1')

        pdf.chapter_title('CONSULTATION NOTES (SOAP)')
        pdf.chapter_body(clean_note)
        
        # 4. Save
        output_dir = "reports"
        os.makedirs(output_dir, exist_ok=True)
        filename = f"{output_dir}/Report_{patient_name.replace(' ', '_')}_{datetime.now().strftime('%H%M%S')}.pdf"
        pdf.output(filename)
        
        return filename

report_service = ReportService()