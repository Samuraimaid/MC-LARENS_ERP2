import urllib.request
import urllib.parse
import time
import io
from PIL import Image

def test_fetch(prompt):
    encoded = urllib.parse.quote(prompt)
    urls = [
        f"https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024&nologo=true&model=flux",
        f"https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024&nologo=true&model=turbo",
        f"https://gen.pollinations.ai/image/{encoded}?width=1024&height=1024",
    ]
    for url in urls:
        print(f"Trying URL: {url[:80]}...")
        for attempt in range(3):
            try:
                req = urllib.request.Request(
                    url, 
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = resp.read()
                    img = Image.open(io.BytesIO(data))
                    print(f"Success! Image size: {img.size}")
                    return img
            except Exception as e:
                print(f"Attempt {attempt+1} failed: {e}")
                time.sleep(3)

if __name__ == "__main__":
    test_fetch("Front 3/4 three-quarter perspective studio 3D render of a modern white Hyundai Accent (2005-2011) sedan, exact front-left angle view, clearly showing front windshield and side windows, dark grey tinted glass, clean white body, studio lighting, isolated on solid pure white background, high resolution, no watermark, no text, no ground shadow")
