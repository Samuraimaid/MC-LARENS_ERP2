import os

def main():
    target_dir = r"C:\Users\Xinon\Downloads\logos"
    target_file = os.path.join(target_dir, "index.html")

    html_content = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cascada de Logos Retro - Mundo de Accesorios</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body, html {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: #ffffff; /* Fondo blanco */
        }
        canvas {
            display: block;
            width: 100vw;
            height: 100vh;
        }
    </style>
</head>
<body>

    <canvas id="cascadeCanvas"></canvas>

    <script>
        const canvas = document.getElementById('cascadeCanvas');
        const ctx = canvas.getContext('2d');

        // Configurar tamaño nativo de la pantalla
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // --- RUTAS DE LOS LOGOS EN C:/Users/Xinon/Downloads/logos ---
        const logoSrcs = [
            './1680781462.webp',                      // DS18 Audio
            './c438d49a74fee3f108f3fc038f4aae95.jpg',  // AUXBEAM LED
            './DLAA_Logo.png',                         // DLAA
            './FOXF-88937fb1.png',                     // FOX Racing Shox
            './Pioneer-Logo.jpg',                      // Pioneer Car Audio
            './R.jpg',                                 // KEKO Accesorios
            './solar-gard-logo-png-transparent.png'    // Solar Gard Window Films
        ];

        // Precarga de imágenes
        const images = [];
        let loadedImagesCount = 0;

        logoSrcs.forEach(src => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                loadedImagesCount++;
                if (loadedImagesCount === logoSrcs.length) {
                    initCascade();
                }
            };
            img.onerror = () => {
                console.warn('No se pudo cargar la imagen:', src);
                loadedImagesCount++;
                if (loadedImagesCount === logoSrcs.length && images.length > 0) {
                    initCascade();
                }
            };
            images.push(img);
        });

        // --- CONFIGURACIÓN DE TAMAÑOS ---
        // Base width: 140px
        // 25% más pequeño para el más pequeño -> scale ~0.55 (aprox 77px)
        // 200% más grande para el más grande (+200% -> 3.0x - 3.2x) -> scale ~3.20 (aprox 450px)
        const targetWidth = 140;
        const minScale = 0.55;  // 25% más pequeño que el mínimo anterior
        const maxScale = 3.20;  // 200% más grande que el tamaño estándar

        function getRandomScale() {
            // Distribución natural con variación amplia
            return minScale + Math.random() * (maxScale - minScale);
        }

        function calculateSpeed(scale) {
            // Efecto de profundidad paralaje (los logos gigantes caen más cerca/rápido)
            const baseSpeed = 2.0 + Math.random() * 3.5;
            return baseSpeed * (0.75 + scale * 0.45);
        }

        let columnsCount = Math.max(4, Math.floor(window.innerWidth / 160));
        const columns = [];

        function initCascade() {
            columnsCount = Math.max(4, Math.floor(canvas.width / 160));
            columns.length = 0;

            for (let i = 0; i < columnsCount; i++) {
                const randomImg = images[Math.floor(Math.random() * images.length)];
                const scale = getRandomScale();
                
                columns.push({
                    x: i * (canvas.width / columnsCount) + (Math.random() * 30 - 15),
                    y: Math.random() * -canvas.height * 1.2 - 150,
                    speed: calculateSpeed(scale),
                    img: randomImg,
                    scale: scale
                });
            }
            animate();
        }

        let isRunning = false;
        function animate() {
            if (isRunning) return;
            
            function loop() {
                // Fondo blanco limpio
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Ordenar por escala para que los logos grandes queden en primer plano
                columns.sort((a, b) => a.scale - b.scale);

                columns.forEach(col => {
                    const img = col.img;
                    if (!img || !img.complete || img.naturalWidth === 0) return;
                    
                    const aspectRatio = img.height / img.width;
                    const width = targetWidth * col.scale;
                    const height = width * aspectRatio;

                    // Dibujar el logotipo escalado
                    ctx.drawImage(img, col.x, col.y, width, height);

                    // Mover hacia abajo
                    col.y += col.speed;

                    // Si sale completamente de pantalla por abajo
                    if (col.y > canvas.height + 50) {
                        const newScale = getRandomScale();
                        col.scale = newScale;
                        col.speed = calculateSpeed(newScale);
                        col.img = images[Math.floor(Math.random() * images.length)];
                        
                        const newAspect = col.img.height / col.img.width;
                        const newHeight = (targetWidth * newScale) * newAspect;
                        
                        // Reiniciar arriba con desfase aleatorio
                        col.y = -newHeight - (Math.random() * 350 + 50);
                    }
                });

                requestAnimationFrame(loop);
            }

            isRunning = true;
            loop();
        }
    </script>
</body>
</html>
"""

    with open(target_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"SUCCESS: Updated {target_file} with larger scale range ({len(html_content)} bytes)")

if __name__ == "__main__":
    main()
