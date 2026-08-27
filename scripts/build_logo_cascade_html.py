import os

def main():
    target_dir = r"C:\Users\Xinon\Downloads\logos"
    target_file = os.path.join(target_dir, "index.html")

    html_content = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mundo de Accesorios ERP - Cascada de Logos & Workbench</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
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
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: #0b0f19;
            color: #f8fafc;
        }

        /* --- PANTALLA DE CARGA (CASCADA + OVERLAY) --- */
        #loaderScreen {
            position: fixed;
            inset: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #ffffff;
            transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.7s ease, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }

        #loaderScreen.fade-out {
            opacity: 0;
            visibility: hidden;
            transform: scale(1.05);
            pointer-events: none;
        }

        canvas#cascadeCanvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: block;
        }

        /* Tarjeta central de progreso sobre la cascada */
        .loader-center-card {
            position: relative;
            z-index: 10;
            background: rgba(15, 23, 42, 0.88);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 28px;
            padding: 2.25rem 2.5rem;
            max-width: 520px;
            width: 90%;
            box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 35px rgba(0, 210, 255, 0.2);
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.25rem;
            animation: cardFloat 3s ease-in-out infinite alternate;
        }

        @keyframes cardFloat {
            0% { transform: translateY(0); }
            100% { transform: translateY(-6px); }
        }

        .brand-title {
            font-size: 1.85rem;
            font-weight: 900;
            font-style: italic;
            letter-spacing: 0.5px;
            color: #ffe600;
            background: linear-gradient(180deg, #fff975 0%, #ffe600 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 4px 15px rgba(0,0,0,0.5);
        }

        .brand-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            background: rgba(0, 210, 255, 0.12);
            border: 1px solid rgba(0, 210, 255, 0.4);
            padding: 0.25rem 0.85rem;
            border-radius: 999px;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: #38bdf8;
        }

        .loader-status {
            font-size: 1rem;
            font-weight: 600;
            color: #e2e8f0;
            min-height: 24px;
        }

        /* BARRA DE CARGA */
        .progress-track {
            width: 100%;
            height: 10px;
            background: rgba(255, 255, 255, 0.12);
            border-radius: 999px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.08);
            position: relative;
        }

        .progress-fill {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #00d2ff 0%, #38bdf8 50%, #ffe600 100%);
            border-radius: 999px;
            box-shadow: 0 0 16px rgba(0, 210, 255, 0.9);
            transition: width 0.15s cubic-bezier(0.1, 0.9, 0.2, 1);
        }

        .progress-meta {
            display: flex;
            justify-content: space-between;
            width: 100%;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.78rem;
            color: #94a3b8;
        }

        /* --- WORKBENCH (ERP INTERFAZ) --- */
        #workbenchScreen {
            width: 100%;
            height: 100%;
            overflow-y: auto;
            background: #090d16;
            color: #f1f5f9;
            display: flex;
            flex-direction: column;
            opacity: 0;
            transform: translateY(12px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }

        #workbenchScreen.visible {
            opacity: 1;
            transform: translateY(0);
        }

        /* Barra de navegación superior del Workbench */
        .wb-navbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.85rem 1.75rem;
            background: #0f172a;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .wb-brand {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-weight: 800;
            font-size: 1.15rem;
        }

        .wb-brand span.logo-tag {
            background: #ffe600;
            color: #000;
            font-size: 0.75rem;
            padding: 0.15rem 0.5rem;
            border-radius: 4px;
            font-weight: 900;
        }

        .wb-user-pill {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 0.35rem 0.85rem;
            border-radius: 999px;
            font-size: 0.85rem;
        }

        .btn-reload {
            background: rgba(0, 210, 255, 0.15);
            border: 1px solid #00d2ff;
            color: #00d2ff;
            padding: 0.4rem 0.9rem;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .btn-reload:hover {
            background: #00d2ff;
            color: #000;
            box-shadow: 0 0 15px rgba(0, 210, 255, 0.4);
        }

        /* Contenido del Workbench */
        .wb-content {
            padding: 2rem;
            max-width: 1400px;
            margin: 0 auto;
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 1.75rem;
        }

        .wb-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
        }

        .wb-header h1 {
            font-size: 1.75rem;
            font-weight: 800;
        }

        .wb-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 1.5rem;
        }

        @media (max-width: 960px) {
            .wb-grid { grid-template-columns: 1fr; }
        }

        .wb-card {
            background: #0f172a;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 18px;
            padding: 1.5rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .wb-card h3 {
            font-size: 1.1rem;
            font-weight: 700;
            margin-bottom: 1rem;
            color: #38bdf8;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .catalog-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 1rem;
        }

        .product-tile {
            background: #1e293b;
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            padding: 1rem;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
            transition: transform 0.2s, border-color 0.2s;
        }
        .product-tile:hover {
            transform: translateY(-3px);
            border-color: #00d2ff;
        }

        .product-tile img {
            max-height: 50px;
            max-width: 90%;
            object-fit: contain;
            background: #ffffff;
            padding: 6px;
            border-radius: 8px;
        }

        .product-title {
            font-size: 0.85rem;
            font-weight: 700;
        }
        .product-price {
            font-size: 0.9rem;
            color: #ffe600;
            font-weight: 800;
        }
    </style>
</head>
<body>

    <!-- 1. PANTALLA DE CARGA (CASCADA DE LOGOS RETRO + BARRA DE CARGA) -->
    <div id="loaderScreen">
        <canvas id="cascadeCanvas"></canvas>

        <div class="loader-center-card">
            <div>
                <div class="brand-title">MUNDO DE ACCESORIOS</div>
                <div class="brand-badge">★ Distribuidores Oficiales ★</div>
            </div>

            <div class="loader-status" id="statusText">Iniciando módulos del ERP...</div>

            <div class="progress-track">
                <div class="progress-fill" id="progressFill"></div>
            </div>

            <div class="progress-meta">
                <span id="metaDetails">SINCRONIZANDO MARCAS Y PRODUCTOS</span>
                <span id="percentLabel">0%</span>
            </div>
        </div>
    </div>

    <!-- 2. WORKBENCH PRINCIPAL (SE MUESTRA SOLO AL COMPLETAR EL 100%) -->
    <div id="workbenchScreen">
        <nav class="wb-navbar">
            <div class="wb-brand">
                <span>MUNDO DE ACCESORIOS ERP</span>
                <span class="logo-tag">PROD</span>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <button class="btn-reload" onclick="restartLoadingSimulation()">🔄 Simular Carga</button>
                <div class="wb-user-pill">
                    <span style="color: #4ade80;">●</span>
                    <span>Admin Central</span>
                </div>
            </div>
        </nav>

        <main class="wb-content">
            <div class="wb-header">
                <div>
                    <h1>Workbench de Ventas & Catálogo</h1>
                    <p style="color: #94a3b8; font-size: 0.9rem;">Catálogo oficial sincronizado y listo para facturación</p>
                </div>
            </div>

            <div class="wb-grid">
                <!-- PANEL DE PRODUCTOS / MARCAS -->
                <div class="wb-card">
                    <h3>📦 Marcas Oficiales Disponibles en Inventario</h3>
                    <div class="catalog-grid">
                        <div class="product-tile">
                            <img src="./1680781462.webp" alt="DS18">
                            <span class="product-title">Audio DS18 Pro</span>
                            <span class="product-price">Stock: 48 uds</span>
                        </div>
                        <div class="product-tile">
                            <img src="./FOXF-88937fb1.png" alt="FOX">
                            <span class="product-title">FOX Suspension</span>
                            <span class="product-price">Stock: 16 uds</span>
                        </div>
                        <div class="product-tile">
                            <img src="./Pioneer-Logo.jpg" alt="Pioneer">
                            <span class="product-title">Pioneer Multimedia</span>
                            <span class="product-price">Stock: 32 uds</span>
                        </div>
                        <div class="product-tile">
                            <img src="./solar-gard-logo-png-transparent.png" alt="Solar Gard">
                            <span class="product-title">Solar Gard Film</span>
                            <span class="product-price">Stock: 120 mts</span>
                        </div>
                        <div class="product-tile">
                            <img src="./R.jpg" alt="KEKO">
                            <span class="product-title">KEKO Accesorios</span>
                            <span class="product-price">Stock: 24 uds</span>
                        </div>
                        <div class="product-tile">
                            <img src="./c438d49a74fee3f108f3fc038f4aae95.jpg" alt="AUXBEAM">
                            <span class="product-title">AUXBEAM LED</span>
                            <span class="product-price">Stock: 55 uds</span>
                        </div>
                        <div class="product-tile">
                            <img src="./DLAA_Logo.png" alt="DLAA">
                            <span class="product-title">DLAA Neblineras</span>
                            <span class="product-price">Stock: 70 uds</span>
                        </div>
                    </div>
                </div>

                <!-- PANEL DE RESUMEN -->
                <div class="wb-card">
                    <h3>⚡ Estado del Sistema</h3>
                    <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.9rem;">
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.5rem;">
                            <span style="color: #94a3b8;">Servidor Cloud:</span>
                            <span style="color: #4ade80; font-weight: 700;">Conectado (OK)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.5rem;">
                            <span style="color: #94a3b8;">Marcas Cargadas:</span>
                            <span style="font-weight: 700;">7 Oficiales</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.5rem;">
                            <span style="color: #94a3b8;">Modo de Pantalla:</span>
                            <span>Workbench Activo</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- SCRIPT DE CASCADA Y CONTROL DE CARGA -->
    <script>
        const canvas = document.getElementById('cascadeCanvas');
        const ctx = canvas.getContext('2d');
        const loaderScreen = document.getElementById('loaderScreen');
        const workbenchScreen = document.getElementById('workbenchScreen');
        const progressFill = document.getElementById('progressFill');
        const percentLabel = document.getElementById('percentLabel');
        const statusText = document.getElementById('statusText');
        const metaDetails = document.getElementById('metaDetails');

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Rutas locales de los logotipos
        const logoSrcs = [
            './1680781462.webp',                      // DS18 Audio
            './c438d49a74fee3f108f3fc038f4aae95.jpg',  // AUXBEAM LED
            './DLAA_Logo.png',                         // DLAA
            './FOXF-88937fb1.png',                     // FOX Racing Shox
            './Pioneer-Logo.jpg',                      // Pioneer Car Audio
            './R.jpg',                                 // KEKO Accesorios
            './solar-gard-logo-png-transparent.png'    // Solar Gard Window Films
        ];

        const images = [];
        let loadedImagesCount = 0;

        logoSrcs.forEach(src => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                loadedImagesCount++;
                checkReady();
            };
            img.onerror = () => {
                console.warn('Error cargando imagen:', src);
                loadedImagesCount++;
                checkReady();
            };
            images.push(img);
        });

        // Configuración de escalas:
        // - El más pequeño: 25% más pequeño (scale 0.55 -> ~77px)
        // - El más grande: 200% más grande (scale 3.20 -> ~450px)
        const targetWidth = 140;
        const minScale = 0.55;
        const maxScale = 3.20;

        function getRandomScale() {
            return minScale + Math.random() * (maxScale - minScale);
        }

        function calculateSpeed(scale) {
            return (2.0 + Math.random() * 3.5) * (0.75 + scale * 0.45);
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
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                columns.sort((a, b) => a.scale - b.scale);

                columns.forEach(col => {
                    const img = col.img;
                    if (!img || !img.complete || img.naturalWidth === 0) return;
                    
                    const aspectRatio = img.height / img.width;
                    const width = targetWidth * col.scale;
                    const height = width * aspectRatio;

                    ctx.drawImage(img, col.x, col.y, width, height);
                    col.y += col.speed;

                    if (col.y > canvas.height + 50) {
                        const newScale = getRandomScale();
                        col.scale = newScale;
                        col.speed = calculateSpeed(newScale);
                        col.img = images[Math.floor(Math.random() * images.length)];
                        
                        const newAspect = col.img.height / col.img.width;
                        const newHeight = (targetWidth * newScale) * newAspect;
                        col.y = -newHeight - (Math.random() * 350 + 50);
                    }
                });

                requestAnimationFrame(loop);
            }

            isRunning = true;
            loop();
        }

        // --- SISTEMA DE PROGRESO DE CARGA HACIA EL WORKBENCH ---
        let currentProgress = 0;
        let progressInterval = null;

        function checkReady() {
            if (loadedImagesCount === logoSrcs.length) {
                initCascade();
                startLoadingSequence();
            }
        }

        const stages = [
            { pct: 20, status: "Cargando logotipos de marcas...", meta: "DESCARGANDO RECURSOS GRÁFICOS" },
            { pct: 45, status: "Sincronizando catálogo de repuestos y audio...", meta: "CONECTANDO CON INVENTARIO" },
            { pct: 75, status: "Inicializando base de datos y precios...", meta: "VALIDANDO TASAS DE CAMBIO" },
            { pct: 95, status: "Optimizando Workbench...", meta: "PREPARANDO ESPACIO DE TRABAJO" },
            { pct: 100, status: "¡Todo cargado con éxito!", meta: "ABRIENDO WORKBENCH" }
        ];

        function startLoadingSequence() {
            currentProgress = 0;
            if (progressInterval) clearInterval(progressInterval);

            progressInterval = setInterval(() => {
                // Incremento dinámico realista
                const step = Math.random() * 6 + 2;
                currentProgress = Math.min(100, currentProgress + step);

                progressFill.style.width = `${currentProgress}%`;
                percentLabel.textContent = `${Math.round(currentProgress)}%`;

                const stage = stages.find(s => currentProgress <= s.pct) || stages[stages.length - 1];
                statusText.textContent = stage.status;
                metaDetails.textContent = `${stage.meta} (${Math.round(currentProgress)}%)`;

                if (currentProgress >= 100) {
                    clearInterval(progressInterval);
                    setTimeout(() => {
                        // Ocultar cascada con fade-out y mostrar Workbench
                        loaderScreen.classList.add('fade-out');
                        workbenchScreen.classList.add('visible');
                    }, 600);
                }
            }, 120);
        }

        function restartLoadingSimulation() {
            workbenchScreen.classList.remove('visible');
            loaderScreen.classList.remove('fade-out');
            setTimeout(() => {
                startLoadingSequence();
            }, 300);
        }
    </script>
</body>
</html>
"""

    with open(target_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"SUCCESS: Generated {target_file} with progress bar & workbench reveal ({len(html_content)} bytes)")

if __name__ == "__main__":
    main()
