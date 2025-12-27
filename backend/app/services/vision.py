import ollama

class VisionService:
    def __init__(self, model="llava"):
        self.model = model

    def analyze_image(self, image_path):
        print("👁️ Vision Agent is analyzing the image...")
        
        prompt = """
        You are an expert Medical Imaging Assistant.
        Describe the medical condition visible in this image concisely.
        If it is an X-Ray, describe fractures or opacities.
        If it is a skin condition, describe color, texture, and pattern.
        Do not provide a diagnosis, just clinical observation.
        """

        try:
            response = ollama.chat(
                model=self.model,
                messages=[{
                    'role': 'user',
                    'content': prompt,
                    'images': [image_path]
                }]
            )
            return response['message']['content']
        except Exception as e:
            return f"Error analyzing image: {str(e)}"

vision_service = VisionService()