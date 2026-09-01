import os
from PIL import Image

def process_all_brand_logos():
    brands_dir = r'c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\public\brands'
    public_dir = r'c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\public'
    
    # 1. Process McLarenS official logo: convert dark text to white, keep red S vibrant
    mclarens_src = os.path.join(brands_dir, 'Mc-LarenS logo.png')
    if os.path.exists(mclarens_src):
        im = Image.open(mclarens_src).convert("RGBA")
        bbox = im.getbbox()
        if bbox:
            im = im.crop(bbox)
        
        # Make a white + red version for dark backgrounds
        out_white = Image.new("RGBA", im.size, (0, 0, 0, 0))
        pix_in = im.load()
        pix_out = out_white.load()
        w, h = im.size
        
        for y in range(h):
            for x in range(w):
                r, g, b, a = pix_in[x, y]
                if a < 5:
                    continue
                # Red S detection: high R, low G/B
                if r > 120 and (r - g) > 40 and (r - b) > 40:
                    pix_out[x, y] = (239, 45, 45, a)
                else:
                    # Dark text -> convert to crisp White (#FFFFFF)
                    pix_out[x, y] = (255, 255, 255, a)
                    
        # Resize to max width 1200 for fast loading while maintaining extreme crispness
        target_w = min(1200, out_white.width)
        target_h = int(out_white.height * (target_w / out_white.width))
        out_white_resized = out_white.resize((target_w, target_h), Image.Resampling.LANCZOS)
        
        # Save as main bottom-right logo
        out_white_resized.save(os.path.join(public_dir, 'mclarens-logo-white-red.png'), "PNG")
        out_white_resized.save(os.path.join(brands_dir, 'mclarens-white-red.png'), "PNG")
        print(f"Processed McLarenS logo: {out_white_resized.size}")

    # 2. Process all other brand logos
    brand_mapping = {
        'AUXBEAM logo.png': 'auxbeam-brand-logo.png',
        'FOX logo.png': 'fox-brand-logo.png',
        'RIGID logo.png': 'rigid-brand-logo.png',
        'SOLAR GARD logo.png': 'solargard-brand-logo.png',
        'DS18 logo.png': 'ds18-brand-logo.png',
        'KEKO logo.png': 'keko-brand-logo.png',
        'AUTOBULL logo.png': 'autobull-brand-logo.png',
        'AFN logo.png': 'afn-brand-logo.png',
        'MUNDO DE ACCESORIOS logo.png': 'mundo-accesorios-brand-logo.png',
    }

    for src_name, dst_name in brand_mapping.items():
        src_path = os.path.join(brands_dir, src_name)
        if not os.path.exists(src_path):
            continue
        im = Image.open(src_path).convert("RGBA")
        bbox = im.getbbox()
        if bbox:
            im = im.crop(bbox)
            
        # Target size max width 600
        if im.width > 600:
            target_w = 600
            target_h = int(im.height * (target_w / im.width))
            im = im.resize((target_w, target_h), Image.Resampling.LANCZOS)
            
        dst_path = os.path.join(brands_dir, dst_name)
        im.save(dst_path, "PNG")
        print(f"Processed {src_name} -> {dst_name}: {im.size}")

if __name__ == '__main__':
    process_all_brand_logos()
