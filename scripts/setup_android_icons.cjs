const fs = require('fs');
const path = require('path');

const srcIcon = path.join(__dirname, '..', 'frontend', 'public', 'icon-512.png');
const fallbackIcon = path.join(__dirname, '..', 'frontend', 'public', 'logo.png');

const iconPath = fs.existsSync(srcIcon) ? srcIcon : fallbackIcon;
const iconBuffer = fs.readFileSync(iconPath);

const resDir = path.join(__dirname, '..', 'frontend', 'android', 'app', 'src', 'main', 'res');

const mipmapFolders = [
  'mipmap-ldpi',
  'mipmap-mdpi',
  'mipmap-hdpi',
  'mipmap-xhdpi',
  'mipmap-xxhdpi',
  'mipmap-xxxhdpi',
];

mipmapFolders.forEach((folder) => {
  const dir = path.join(resDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), iconBuffer);
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), iconBuffer);
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), iconBuffer);
  console.log(`Created icons in ${folder}`);
});

// anydpi-v26
const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
fs.mkdirSync(anydpiDir, { recursive: true });

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;

fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveXml);
fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml);

// drawables
const drawDir = path.join(resDir, 'drawable');
fs.mkdirSync(drawDir, { recursive: true });

const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#09090B"
        android:pathData="M0,0h108v108h-108z"/>
</vector>
`;

fs.writeFileSync(path.join(drawDir, 'ic_launcher_background.xml'), bgXml);
fs.writeFileSync(path.join(drawDir, 'splash.png'), iconBuffer);

console.log('Successfully generated all Android mipmap and drawable assets!');
