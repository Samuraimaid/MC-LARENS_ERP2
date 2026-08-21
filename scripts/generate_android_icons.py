import os
from PIL import Image, ImageDraw

def generate_icons():
    src_path = os.path.join('frontend', 'public', 'icon-512.png')
    if not os.path.exists(src_path):
        src_path = os.path.join('frontend', 'public', 'logo.png')
    
    base_img = Image.open(src_path).convert('RGBA')

    densities = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }

    res_dir = os.path.join('frontend', 'android', 'app', 'src', 'main', 'res')

    for folder, size in densities.items():
        target_dir = os.path.join(res_dir, folder)
        os.makedirs(target_dir, exist_ok=True)
        
        # Square icon
        resized = base_img.resize((size, size), Image.LANCZOS)
        resized.save(os.path.join(target_dir, 'ic_launcher.png'), format='PNG')
        
        # Round icon
        mask = Image.new('L', (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size, size), fill=255)
        
        round_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        round_img.paste(resized, (0, 0), mask=mask)
        round_img.save(os.path.join(target_dir, 'ic_launcher_round.png'), format='PNG')
        print(f'Generated {folder} ({size}x{size})')

    # Create anydpi-v26
    anydpi_dir = os.path.join(res_dir, 'mipmap-anydpi-v26')
    os.makedirs(anydpi_dir, exist_ok=True)

    adaptive_xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@drawable/ic_launcher_background" />\n'
        '    <foreground android:drawable="@drawable/ic_launcher_foreground" />\n'
        '</adaptive-icon>\n'
    )

    with open(os.path.join(anydpi_dir, 'ic_launcher.xml'), 'w', encoding='utf-8') as f:
        f.write(adaptive_xml)

    with open(os.path.join(anydpi_dir, 'ic_launcher_round.xml'), 'w', encoding='utf-8') as f:
        f.write(adaptive_xml)

    # Create drawables
    draw_dir = os.path.join(res_dir, 'drawable')
    os.makedirs(draw_dir, exist_ok=True)

    bg_xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        '    android:width="108dp"\n'
        '    android:height="108dp"\n'
        '    android:viewportWidth="108"\n'
        '    android:viewportHeight="108">\n'
        '    <path\n'
        '        android:fillColor="#09090B"\n'
        '        android:pathData="M0,0h108v108h-108z"/>\n'
        '</vector>\n'
    )

    fg_xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        '    android:width="108dp"\n'
        '    android:height="108dp"\n'
        '    android:viewportWidth="108"\n'
        '    android:viewportHeight="108">\n'
        '    <path\n'
        '        android:fillColor="#38BDF8"\n'
        '        android:pathData="M30,30 L78,30 L78,78 L30,78 Z"/>\n'
        '</vector>\n'
    )

    with open(os.path.join(draw_dir, 'ic_launcher_background.xml'), 'w', encoding='utf-8') as f:
        f.write(bg_xml)

    with open(os.path.join(draw_dir, 'ic_launcher_foreground.xml'), 'w', encoding='utf-8') as f:
        f.write(fg_xml)

    # Splash
    splash_img = base_img.resize((512, 512), Image.LANCZOS)
    splash_img.save(os.path.join(draw_dir, 'splash.png'), format='PNG')

    print('All Android mipmap and drawable assets generated successfully!')

if __name__ == '__main__':
    generate_icons()
