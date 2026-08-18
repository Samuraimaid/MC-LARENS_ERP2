import os
import shutil

def main():
    src_icon = os.path.join('frontend', 'public', 'icon-512.png')
    if not os.path.exists(src_icon):
        src_icon = os.path.join('frontend', 'public', 'logo.png')

    res_dir = os.path.join('frontend', 'android', 'app', 'src', 'main', 'res')

    mipmap_folders = [
        'mipmap-ldpi',
        'mipmap-mdpi',
        'mipmap-hdpi',
        'mipmap-xhdpi',
        'mipmap-xxhdpi',
        'mipmap-xxxhdpi',
    ]

    for folder in mipmap_folders:
        target_dir = os.path.join(res_dir, folder)
        os.makedirs(target_dir, exist_ok=True)
        shutil.copyfile(src_icon, os.path.join(target_dir, 'ic_launcher.png'))
        shutil.copyfile(src_icon, os.path.join(target_dir, 'ic_launcher_round.png'))
        shutil.copyfile(src_icon, os.path.join(target_dir, 'ic_launcher_foreground.png'))
        print(f'Created icons in {folder}')

    anydpi_dir = os.path.join(res_dir, 'mipmap-anydpi-v26')
    os.makedirs(anydpi_dir, exist_ok=True)

    adaptive_xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@drawable/ic_launcher_background" />\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
        '</adaptive-icon>\n'
    )

    with open(os.path.join(anydpi_dir, 'ic_launcher.xml'), 'w', encoding='utf-8') as f:
        f.write(adaptive_xml)

    with open(os.path.join(anydpi_dir, 'ic_launcher_round.xml'), 'w', encoding='utf-8') as f:
        f.write(adaptive_xml)

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

    with open(os.path.join(draw_dir, 'ic_launcher_background.xml'), 'w', encoding='utf-8') as f:
        f.write(bg_xml)

    shutil.copyfile(src_icon, os.path.join(draw_dir, 'splash.png'))

    print('All Android mipmap and drawable assets generated successfully!')

if __name__ == '__main__':
    main()
