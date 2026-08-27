import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const LOGO_SRCS = [
  { id: "ds18", src: "/brands/ds18.png" },
  { id: "auxbeam", src: "/brands/auxbeam.jpg" },
  { id: "dlaa", src: "/brands/dlaa.png" },
  { id: "fox", src: "/brands/fox.png" },
  { id: "pioneer", src: "/brands/pioneer.jpg" },
  { id: "keko", src: "/brands/keko.jpg" },
  { id: "solargard", src: "/brands/solargard.png" },
];

/**
 * LogoCascadeLoader Component
 * Fullscreen retro canvas falling logo cascade with centered glassmorphism loading card and progress bar.
 * Exact implementation of the HTML5 cascade from C:\Users\Xinon\Downloads\logos\index.html
 */
export default function LogoCascadeLoader({
  statusText = "Iniciando sesión en Mundo de Accesorios...",
  progress,
  onComplete,
  className = "",
}) {
  const canvasRef = useRef(null);
  const [currentProgress, setCurrentProgress] = useState(progress ?? 0);
  const [statusMessage, setStatusMessage] = useState(statusText);

  // 1. CANVAS CASCADE ANIMATION
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let animationFrameId;
    let isMounted = true;

    function resizeCanvas() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Preload brand images
    const images = [];
    let loadedCount = 0;

    LOGO_SRCS.forEach((logo) => {
      const img = new Image();
      img.src = logo.src;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === LOGO_SRCS.length && isMounted) {
          initCascade();
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === LOGO_SRCS.length && isMounted) {
          initCascade();
        }
      };
      images.push(img);
    });

    const targetWidth = 140;
    const minScale = 0.55; // 25% smaller for background
    const maxScale = 3.20; // 200% larger for foreground

    function getRandomScale() {
      return minScale + Math.random() * (maxScale - minScale);
    }

    function calculateSpeed(scale) {
      return (2.0 + Math.random() * 3.5) * (0.75 + scale * 0.45);
    }

    let columnsCount = Math.max(4, Math.floor(window.innerWidth / 160));
    const columns = [];

    function initCascade() {
      if (!canvas) return;
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
          scale: scale,
        });
      }
      animate();
    }

    function animate() {
      if (!isMounted || !canvas || !ctx) return;

      // Clean white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Sort by scale so larger foreground logos render on top
      columns.sort((a, b) => a.scale - b.scale);

      columns.forEach((col) => {
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
          const newHeight = targetWidth * newScale * newAspect;
          col.y = -newHeight - (Math.random() * 350 + 50);
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      isMounted = false;
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 2. SIMULATED / REAL PROGRESS BAR
  useEffect(() => {
    if (typeof progress === "number") {
      setCurrentProgress(progress);
      return undefined;
    }

    const stages = [
      { pct: 25, status: "Descargando recursos de marcas..." },
      { pct: 55, status: "Sincronizando catálogo e inventario..." },
      { pct: 85, status: "Validando sesión y permisos..." },
      { pct: 98, status: "Optimizando Workbench..." },
      { pct: 100, status: "¡Todo listo! Abriendo Workbench..." },
    ];

    const timer = setInterval(() => {
      setCurrentProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          if (onComplete) onComplete();
          return 100;
        }
        const next = Math.min(100, prev + Math.random() * 8 + 3);
        const stage = stages.find((s) => next <= s.pct) || stages[stages.length - 1];
        setStatusMessage(stage.status);
        return next;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [progress, onComplete]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-white animate-fade-in overflow-hidden select-none",
        className
      )}
    >
      {/* 1. RETRO LOGO CASCADE CANVAS */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* 2. CENTERED GLASSMORPHISM CARD */}
      <div className="relative z-10 mx-4 max-w-lg w-full rounded-3xl border border-white/20 bg-slate-950/90 p-8 sm:p-10 text-center shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95 flex flex-col items-center gap-5 animate-float-soft">
        {/* Brand Title */}
        <div className="flex flex-col items-center gap-1.5">
          <h2 className="font-heading text-2xl sm:text-3xl font-black italic tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-500 drop-shadow">
            MUNDO DE ACCESORIOS
          </h2>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/10 px-3.5 py-0.5 text-xs font-bold uppercase tracking-wider text-sky-400 shadow-sm">
            <span>★</span> Distribuidores Oficiales <span>★</span>
          </div>
        </div>

        {/* Status Text */}
        <div className="text-sm sm:text-base font-semibold text-slate-200 min-h-[24px]">
          {statusMessage}
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-2.5 rounded-full bg-white/15 overflow-hidden border border-white/10 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-yellow-400 to-amber-500 shadow-[0_0_14px_rgba(0,210,255,0.9)] transition-all duration-150"
            style={{ width: `${Math.round(currentProgress)}%` }}
          />
        </div>

        {/* Progress Meta Details */}
        <div className="w-full flex items-center justify-between font-mono text-xs text-slate-400 tracking-wider">
          <span>SINCRONIZANDO MARCAS Y PRODUCTOS</span>
          <span className="text-sky-400 font-bold">{Math.round(currentProgress)}%</span>
        </div>
      </div>
    </div>
  );
}
