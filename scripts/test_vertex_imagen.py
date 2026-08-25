"""
Script de diagnóstico para verificar modelos disponibles en Vertex AI
"""
import subprocess
import sys

print("[1] Instalando / verificando google-genai...")
subprocess.run([sys.executable, "-m", "pip", "install", "--user", "--quiet", "google-genai", "Pillow"], check=False)

import site
site.main()

try:
    from google import genai
    from google.genai import types
    print("[2] Inicializando cliente Vertex AI...")
    client = genai.Client(vertexai=True, project="gen-lang-client-0971793042", location="us-central1")
    
    print("[3] Probando generación con imagen-3.0-generate-002...")
    result = client.models.generate_images(
        model='imagen-3.0-generate-002',
        prompt='A clean white car side view on white background',
        config=types.GenerateImagesConfig(
            number_of_images=1,
            aspect_ratio="16:9",
            output_mime_type="image/jpeg",
        )
    )
    print(f"[OK] ¡ÉXITO TOTAL! Se generaron {len(result.generated_images)} imágenes.")
except Exception as e:
    print(f"[ERROR con imagen-3.0-generate-002]: {e}")
    try:
        print("[4] Probando con imagen-3.0-fast-generate-001...")
        result = client.models.generate_images(
            model='imagen-3.0-fast-generate-001',
            prompt='A clean white car side view on white background',
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="16:9",
                output_mime_type="image/jpeg",
            )
        )
        print(f"[OK] ¡ÉXITO TOTAL con fast! Se generaron {len(result.generated_images)} imágenes.")
    except Exception as e2:
        print(f"[ERROR con fast]: {e2}")
