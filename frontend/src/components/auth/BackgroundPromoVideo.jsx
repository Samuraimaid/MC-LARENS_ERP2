import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  DEFAULT_PROMOTIONAL_VIDEOS, 
  fetchPromotionalVideos, 
  getCachedVideoPlaybackUrl, 
  prefetchPromotionalVideos,
  isLowMemoryOrSmartTVDevice,
  resolveDirectPromoVideoUrl
} from "@/lib/promoVideos";

export default function BackgroundPromoVideo({
  isPortrait = false,
  isMuted = true,
  onInteract,
  onVideoChange,
  allowWidescreenOnMobile = true,
  showOverlay = true,
}) {
  const [videos, setVideos] = useState(DEFAULT_PROMOTIONAL_VIDEOS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolvedVideoSrc, setResolvedVideoSrc] = useState("");
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [useSlowNetworkFallback, setUseSlowNetworkFallback] = useState(() => {
    if (typeof navigator !== "undefined" && navigator.connection) {
      const conn = navigator.connection;
      if (conn.saveData) return true;
      if (conn.effectiveType === "2g" || conn.effectiveType === "slow-2g") return true;
      if (conn.downlink && conn.downlink < 1.2) return true;
    }
    return false;
  });
  
  const videoRef = useRef(null);
  const lastTimeRef = useRef(0);
  const stallCountRef = useRef(0);
  const transitionTimeoutRef = useRef(null);

  // Watchdog de red lenta: si el video no reproduce en 3.5s en conexiones lentas, activar fondo liviano
  useEffect(() => {
    if (isVideoPlaying || useSlowNetworkFallback) return;
    const slowNetTimer = setTimeout(() => {
      if (!isVideoPlaying) {
        setUseSlowNetworkFallback(true);
      }
    }, 3500);

    return () => clearTimeout(slowNetTimer);
  }, [isVideoPlaying, useSlowNetworkFallback, resolvedVideoSrc]);

  // 1. Cargar y sincronizar lista de videos promocionales periódicamente (detecta videos nuevos en vivo sin recargar)
  useEffect(() => {
    let mounted = true;
    const syncPlaylist = async () => {
      try {
        const list = await fetchPromotionalVideos();
        if (mounted && Array.isArray(list) && list.length > 0) {
          setVideos(list);
          prefetchPromotionalVideos(list);
        }
      } catch (_) {}
    };

    syncPlaylist();
    const interval = setInterval(syncPlaylist, 5 * 60 * 1000); // Sincroniza cada 5 minutos
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Playlist activa según orientación de pantalla y estado activo
  const activePlaylist = useMemo(() => {
    const activeVideos = videos.filter((v) => v.active !== false);
    if (activeVideos.length === 0) return DEFAULT_PROMOTIONAL_VIDEOS;

    if (isPortrait) {
      // Priorizar videos verticales / totem si existen
      const verticalVideos = activeVideos.filter(
        (v) => v.orientation === "vertical" || v.orientation === "totem" || v.orientation === "portrait"
      );
      if (verticalVideos.length > 0) {
        return verticalVideos;
      }
    }

    if (allowWidescreenOnMobile) {
      return activeVideos;
    }

    const targetOrientation = isPortrait ? "vertical" : "horizontal";
    const filtered = activeVideos.filter(
      (v) => (v.active !== false) && (v.orientation === targetOrientation || v.orientation === "universal" || v.orientation === "both" || !v.orientation)
    );
    if (filtered.length > 0) return filtered;
    return activeVideos;
  }, [videos, isPortrait, allowWidescreenOnMobile]);

  // Inicializar índice
  useEffect(() => {
    setCurrentIndex(0);
  }, [isPortrait]);

  const currentVideo = activePlaylist[currentIndex] || activePlaylist[0] || DEFAULT_PROMOTIONAL_VIDEOS[0];
  const bgVideoRef = useRef(null);

  // 3. Notificar al componente padre para sincronizar marca y logotipo
  useEffect(() => {
    if (currentVideo && typeof onVideoChange === "function") {
      onVideoChange(currentVideo);
    }
  }, [currentVideo, onVideoChange]);

  // 4. Cambiar al siguiente video de forma secuencial y limpia
  const handleVideoEnded = useCallback(() => {
    stallCountRef.current = 0;
    if (activePlaylist.length <= 1) {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
      if (bgVideoRef.current) {
        bgVideoRef.current.currentTime = 0;
        bgVideoRef.current.play().catch(() => {});
      }
      return;
    }

    setCurrentIndex((prev) => (prev + 1) % activePlaylist.length);
  }, [activePlaylist.length]);

  // 5. Resolver URL optimizada (Streaming directo a Google Cloud Storage CDN sin saltos 307)
  useEffect(() => {
    let cancelled = false;
    if (currentVideo?.url) {
      getCachedVideoPlaybackUrl(currentVideo.url).then((src) => {
        if (!cancelled && src) {
          const directSrc = resolveDirectPromoVideoUrl(src);
          setResolvedVideoSrc(directSrc);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [currentVideo?.url, currentIndex]);

  // 6. Carga y reproducción en elementos <video>
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedVideoSrc) return;

    setIsVideoPlaying(false);
    stallCountRef.current = 0;

    try {
      video.muted = isMuted;
      video.src = resolvedVideoSrc;
      video.load();

      if (bgVideoRef.current) {
        bgVideoRef.current.muted = true;
        bgVideoRef.current.src = resolvedVideoSrc;
        bgVideoRef.current.load();
        bgVideoRef.current.play().catch(() => {});
      }

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsVideoPlaying(true);
            stallCountRef.current = 0;
            if (bgVideoRef.current && bgVideoRef.current.paused) {
              bgVideoRef.current.play().catch(() => {});
            }
          })
          .catch((err) => {
            console.warn("[BackgroundPromoVideo] Autoplay con audio bloqueado, forzando muted...", err);
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play()
                .then(() => {
                  setIsVideoPlaying(true);
                  if (bgVideoRef.current && bgVideoRef.current.paused) {
                    bgVideoRef.current.play().catch(() => {});
                  }
                })
                .catch(() => {});
            }
          });
      }
    } catch (err) {
      console.warn("[BackgroundPromoVideo] Error al cargar fuente de video:", err);
    }
  }, [resolvedVideoSrc]);

  // 7. Sincronizar estado de mute sin reiniciar la fuente del video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (!isMuted && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isMuted]);

  // 8. Watchdog inteligente anti-pantalla negra para Smart TVs
  useEffect(() => {
    const isTV = isLowMemoryOrSmartTVDevice();
    const intervalMs = isTV ? 4000 : 6000;

    const interval = setInterval(() => {
      const v = videoRef.current;
      if (!v || !resolvedVideoSrc) return;

      if (!v.paused && !v.ended && v.readyState >= 2) {
        if (Math.abs(v.currentTime - lastTimeRef.current) < 0.1) {
          stallCountRef.current += 1;
          // Si el video está congelado en una pantalla negra por más de 12s
          if (stallCountRef.current >= 3) {
            console.warn("[BackgroundPromoVideo Watchdog] Decodificador TV congelado, avanzando al siguiente video...");
            stallCountRef.current = 0;
            handleVideoEnded();
          }
        } else {
          stallCountRef.current = 0;
          lastTimeRef.current = v.currentTime;
        }
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [resolvedVideoSrc, handleVideoEnded]);

  // 9. Reanudación al salir del protector de pantalla o suspensión de la TV
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && videoRef.current) {
        videoRef.current.play().catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
        if (bgVideoRef.current) {
          bgVideoRef.current.play().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, []);

  const isCurrentVideoHorizontalInPortrait = isPortrait && currentVideo?.orientation !== "vertical" && currentVideo?.orientation !== "totem" && currentVideo?.orientation !== "portrait";

  return (
    <div 
      className="absolute inset-0 z-0 overflow-hidden bg-black select-none pointer-events-auto"
      onClick={onInteract}
    >
      {/* Fondo de alta velocidad para conexiones lentas: Cuadrícula tecnológica + Degradado + Marca de agua Mundo de Accesorios */}
      {useSlowNetworkFallback ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-hidden bg-[#070b14] select-none">
          {/* Degradado Radial Profundo */}
          <div 
            className="absolute inset-0 opacity-90"
            style={{
              background: "radial-gradient(ellipse at 50% 35%, rgba(226, 7, 37, 0.22) 0%, rgba(15, 23, 42, 0.9) 50%, #030712 100%)",
            }}
          />

          {/* Cuadrícula Geométrica Estilo Blueprint / Malla Técnica */}
          <div 
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(255, 255, 255, 0.12) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.12) 1px, transparent 1px)
              `,
              backgroundSize: "36px 36px",
            }}
          />

          {/* Marca de Agua Translúcida Mundo de Accesorios con Respiración Sutil */}
          <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center animate-pulse duration-1000">
            <img 
              src="/mundo-logo.png" 
              alt="Mundo de Accesorios" 
              className="w-64 sm:w-80 max-w-[85vw] h-auto object-contain opacity-35 drop-shadow-[0_0_35px_rgba(226,7,37,0.45)] filter contrast-125 transition-all duration-700"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div className="mt-5 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-lg">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-semibold tracking-widest uppercase text-white/70">
                Mundo de Accesorios · Red Conectada
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Fondo ambiental desenfocado del mismo video cuando se muestra video horizontal en pantalla vertical/totem (sin barras negras) */}
      {!useSlowNetworkFallback && isCurrentVideoHorizontalInPortrait && (
        <video
          ref={bgVideoRef}
          autoPlay
          playsInline
          muted
          loop
          preload="auto"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover blur-3xl scale-125 opacity-70 brightness-75 contrast-125 pointer-events-none transition-opacity duration-700"
        />
      )}

      {/* Elemento de video principal con object-contain en modo totem para no recortar ni distorsionar */}
      {!useSlowNetworkFallback && (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        preload="auto"
        onEnded={handleVideoEnded}
        onTimeUpdate={() => {
          if (bgVideoRef.current && videoRef.current) {
            if (Math.abs(bgVideoRef.current.currentTime - videoRef.current.currentTime) > 0.4) {
              bgVideoRef.current.currentTime = videoRef.current.currentTime;
            }
          }
        }}
        onError={(e) => {
          console.warn("[BackgroundPromoVideo] Error al cargar video en Smart TV, esperando antes de avanzar...", e);
          if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
          transitionTimeoutRef.current = setTimeout(() => {
            handleVideoEnded();
          }, 2500);
        }}
        onWaiting={() => {
          stallCountRef.current += 1;
        }}
        onPlaying={() => {
          setIsVideoPlaying(true);
          stallCountRef.current = 0;
          if (bgVideoRef.current && bgVideoRef.current.paused) {
            bgVideoRef.current.play().catch(() => {});
          }
        }}
        className={`relative z-10 h-full w-full transition-opacity duration-700 ${
          isCurrentVideoHorizontalInPortrait
            ? "object-contain shadow-2xl"
            : "object-cover object-center"
        } ${isVideoPlaying ? "opacity-100" : "opacity-90"}`}
      />
      )}

      {/* Capa de viñeta oscura translúcida que solo se activa al interactuar para contrastar el PIN pad */}
      <div 
        className={`absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/30 to-black/65 pointer-events-none transition-opacity duration-700 ease-in-out ${
          showOverlay ? "opacity-100" : "opacity-0"
        }`} 
      />
    </div>
  );
}
