from fpdf import FPDF
import os
from datetime import datetime
import matplotlib
# Set backend to Non-Interactive 'Agg' to prevent GUI errors
matplotlib.use('Agg') 
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

class VitalisPDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.set_text_color(16, 185, 129) # Emerald Green
        self.cell(80)
        self.cell(30, 10, 'VITALIS', 0, 0, 'C')
        self.ln(5)
        
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128, 128, 128) 
        self.cell(0, 10, 'Sovereign Medical Intelligence Platform', 0, 0, 'C')
        self.ln(20)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Page {self.page_no()} | CONFIDENTIAL MEDICAL RECORD', 0, 0, 'C')

    def chapter_title(self, label):
        self.set_font('Arial', 'B', 12)
        self.set_fill_color(240, 240, 240)
        self.set_text_color(0, 0, 0)
        self.cell(0, 10, f'  {label}', 0, 1, 'L', 1)
        self.ln(4)

    def chapter_body(self, text):
        self.set_font('Arial', '', 11)
        self.multi_cell(0, 6, text)
        self.ln()

class ReportService:
    # --- HELPER: Sanitize Text for FPDF (Latin-1) ---
    def clean_text(self, text):
        if not text: return ""
        text = str(text)
        # Replace common problem characters
        replacements = {
            '\u2013': '-', '\u2014': '-', # Dashes
            '\u2018': "'", '\u2019': "'", # Quotes
            '\u2264': '<=', '\u2265': '>=', # Math
            '$': '', '\\times': 'x', '^': '', '~': ' ', # LaTeX artifacts
            '\n': ' '
        }
        for k, v in replacements.items():
            text = text.replace(k, v)
        
        # Final fallback: Encode to latin-1, replacing errors with '?'
        return text.encode('latin-1', 'replace').decode('latin-1')

    # --- 1. GENERATE CONSULTATION REPORT (SOAP) ---
    def generate_report(self, patient_name, patient_age, soap_note, safety_analysis, timestamp=None):
        pdf = VitalisPDF()
        pdf.add_page()
        
        # Patient Info Box
        pdf.set_font("Arial", "", 10)
        date_str = timestamp.strftime("%Y-%m-%d %H:%M") if timestamp else datetime.now().strftime("%Y-%m-%d %H:%M")
        
        pdf.set_draw_color(200, 200, 200)
        pdf.rect(10, 35, 190, 25)
        
        pdf.set_xy(15, 40)
        pdf.set_font("Arial", "B", 10)
        pdf.cell(30, 5, "Patient Name:")
        pdf.set_font("Arial", "", 10)
        pdf.cell(50, 5, self.clean_text(patient_name))
        
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
        
        pdf.ln(20)

        # Safety Banner
        if "WARNING" in safety_analysis:
            pdf.set_fill_color(254, 226, 226)
            pdf.set_text_color(185, 28, 28)
            pdf.set_draw_color(185, 28, 28)
            header_text = " SAFETY ALERT DETECTED"
        else:
            pdf.set_fill_color(209, 250, 229)
            pdf.set_text_color(4, 120, 87)
            pdf.set_draw_color(4, 120, 87)
            header_text = " SAFETY CHECK PASSED"
            
        pdf.set_font('Arial', 'B', 12)
        pdf.cell(0, 12, header_text, 1, 1, 'L', 1)
        
        pdf.set_text_color(50, 50, 50)
        pdf.set_font('Arial', '', 10)
        pdf.multi_cell(0, 6, self.clean_text(safety_analysis))
        pdf.ln(10)

        pdf.chapter_title('CONSULTATION NOTES (SOAP)')
        pdf.chapter_body(self.clean_text(soap_note))
        
        output_dir = "reports"
        os.makedirs(output_dir, exist_ok=True)
        filename = f"{output_dir}/Consult_Report_{self.clean_text(patient_name).replace(' ', '_')}_{datetime.now().strftime('%H%M%S')}.pdf"
        pdf.output(filename)
        return filename

    # --- 2. GENERATE LAB RESULTS REPORT (ALL GRAPHS) ---
    def generate_lab_report(self, patient_name, patient_age, lab_history):
        pdf = VitalisPDF()
        pdf.add_page()
        
        # Patient Info
        pdf.set_font("Arial", "", 10)
        pdf.set_draw_color(200, 200, 200)
        pdf.rect(10, 35, 190, 25)
        
        pdf.set_xy(15, 40)
        pdf.set_font("Arial", "B", 10)
        pdf.cell(30, 5, "Patient Name:")
        pdf.set_font("Arial", "", 10)
        pdf.cell(50, 5, self.clean_text(patient_name))
        
        pdf.set_font("Arial", "B", 10)
        pdf.cell(20, 5, "Report Date:")
        pdf.set_font("Arial", "", 10)
        pdf.cell(40, 5, datetime.now().strftime("%Y-%m-%d"))
        pdf.ln(8)
        
        pdf.set_x(15)
        pdf.set_font("Arial", "B", 10)
        pdf.cell(30, 5, "Patient Age:")
        pdf.set_font("Arial", "", 10)
        pdf.cell(50, 5, str(patient_age))
        pdf.ln(25)

        # Recent Results Table
        pdf.chapter_title('RECENT LAB RESULTS')
        
        pdf.set_font("Arial", "B", 10)
        pdf.set_fill_color(220, 220, 220)
        pdf.cell(60, 8, "Test Name", 1, 0, 'L', 1)
        pdf.cell(30, 8, "Value", 1, 0, 'C', 1)
        pdf.cell(30, 8, "Unit", 1, 0, 'C', 1)
        pdf.cell(30, 8, "Date", 1, 0, 'C', 1)
        pdf.cell(40, 8, "Status", 1, 1, 'C', 1)
        
        pdf.set_font("Arial", "", 10)
        recent_labs = list(reversed(lab_history))[:15]
        
        for lab in recent_labs:
            # FIX: Clean strings before adding to cell to prevent Latin-1 errors
            t_name = self.clean_text(lab.test_name)
            t_val = self.clean_text(lab.value)
            t_unit = self.clean_text(lab.unit)
            t_status = self.clean_text(lab.status)
            t_date = lab.date.strftime("%Y-%m-%d")

            pdf.cell(60, 8, t_name, 1)
            pdf.cell(30, 8, t_val, 1, 0, 'C')
            pdf.cell(30, 8, t_unit, 1, 0, 'C')
            pdf.cell(30, 8, t_date, 1, 0, 'C')
            
            if "High" in t_status or "Low" in t_status:
                pdf.set_text_color(200, 0, 0)
                pdf.set_font("Arial", "B", 10)
            else:
                pdf.set_text_color(0, 100, 0)
                pdf.set_font("Arial", "", 10)
                
            pdf.cell(40, 8, t_status, 1, 1, 'C')
            pdf.set_text_color(0, 0, 0)
            pdf.set_font("Arial", "", 10)

        pdf.ln(10)

        # --- DYNAMIC MULTI-PAGE GRAPHS ---
        pdf.chapter_title('HISTORICAL TRENDS')
        
        if len(lab_history) > 0:
            unique_tests = sorted(list(set([l.test_name for l in lab_history])))
            
            for test in unique_tests:
                data = sorted([l for l in lab_history if l.test_name == test], key=lambda x: x.date)
                if len(data) < 1: continue

                # Page Break
                if pdf.get_y() > 220:
                    pdf.add_page()
                    pdf.chapter_title('HISTORICAL TRENDS (CONT.)')

                dates = [l.date for l in data]
                values = []
                for l in data:
                    try:
                        # Clean numeric string before float conversion
                        clean_val = str(l.value).replace('$', '').replace('~', '').split(' ')[0]
                        values.append(float(clean_val))
                    except:
                        values.append(0)

                fig, ax = plt.subplots(figsize=(8, 3))
                ax.plot(dates, values, marker='o', linestyle='-', color='#10b981', linewidth=2)
                ax.set_title(f"{self.clean_text(test)} History", fontsize=10, fontweight='bold')
                ax.grid(True, linestyle='--', alpha=0.5)
                ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
                plt.xticks(rotation=0)
                plt.tight_layout()
                
                chart_path = f"temp_chart_{self.clean_text(test).replace('/', '_')}.png"
                plt.savefig(chart_path, dpi=100)
                plt.close(fig)
                
                pdf.image(chart_path, x=10, w=190)
                pdf.ln(5)
                
                if os.path.exists(chart_path):
                    os.remove(chart_path)
        
        else:
            pdf.cell(0, 10, "Insufficient data for graphing.", 0, 1)

        output_dir = "reports"
        os.makedirs(output_dir, exist_ok=True)
        # Safe filename
        safe_name = self.clean_text(patient_name).replace(' ', '_').replace('/', '')
        filename = f"{output_dir}/Lab_Report_{safe_name}_{datetime.now().strftime('%H%M%S')}.pdf"
        pdf.output(filename)
        return filename

report_service = ReportService()