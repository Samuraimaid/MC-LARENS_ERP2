"""
Script de prueba de modelos de imagen de Vertex AI
"""
from google import genai
from google.genai import types
from PIL import Image
import io

client = genai.Client(vertexai=True, project="gen-lang-client-0971793042", location="us-central1")

models_to_test = [
    "imagegeneration@006",
    "imagegeneration@005",
    "imagen-3.0-generate-001",
    "imagegeneration@002",
]

print("Probando modelos de generacion en Vertex AI...")
for m in models_to_test:
    print(f"\n--- Probando modelo: {m} ---")
    try:
        res = client.models.generate_images(
            model=m,
            prompt="A lateral view of a white modern car isolated on white background",
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="16:9",
                output_mime_type="image/jpeg",
            )
        )
        if res and res.generated_images:
            img = Image.open(io.BytesIO(res.generated_images[0].image.image_bytes))
            print(f"[EXITO TOTAL CON {m}] Tamano: {img.size}")
            img.save("test_car_output.png")
            print("Guardado en test_car_output.png")
            break
    except Exception as e:
        print(f"Error con {m}: {e}")
