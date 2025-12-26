import os
from faster_whisper import WhisperModel

# Configuration
MODEL_SIZE = "base.en"  # "base.en" is fast. Use "small.en" or "medium.en" for better accuracy later.
DEVICE = "cpu"          # faster-whisper runs great on M3 CPU. 
COMPUTE_TYPE = "int8"   # Quantization for speed

class HearingService:
    def __init__(self):
        print(f"Loading Whisper Model ({MODEL_SIZE})...")
        # Run on CPU with INT8 for Mac efficiency
        self.model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
        print("Whisper Model Loaded.")

    def transcribe_audio(self, file_path: str):
        segments, info = self.model.transcribe(file_path, beam_size=5)
        
        full_text = ""
        for segment in segments:
            full_text += segment.text + " "
            
        return full_text.strip()

# Create a singleton instance
hearing_service = HearingService()