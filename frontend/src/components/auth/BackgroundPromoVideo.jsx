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
  
  const videoRef = useRef(null);
  const lastTimeRef = useRef(0);
  const stallCountRef = useRef(0);
  const transitionTimeoutRef = useRef(null);

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
    if (allowWidescreenOnMobile) {
      const active = videos.filter((v) => v.active !== false);
      if (active.length > 0) return active;
    }
    const targetOrientation = isPortrait ? "vertical" : "horizontal";
    const filtered = videos.filter(
      (v) => (v.active !== false) && (v.orientation === targetOrientation || v.orientation === "universal" || v.orientation === "both" || !v.orientation)
    );
    if (filtered.length > 0) return filtered;
    return videos.filter((v) => v.active !== false);
  }, [videos, isPortrait, allowWidescreenOnMobile]);

  // Inicializar índice
  useEffect(() => {
    setCurrentIndex(0);
  }, [isPortrait]);

  const currentVideo = activePlaylist[currentIndex] || activePlaylist[0] || DEFAULT_PROMOTIONAL_VIDEOS[0];

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

  // 6. Carga y reproducción en elemento <video>
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedVideoSrc) return;

    setIsVideoPlaying(false);
    stallCountRef.current = 0;

    try {
      video.muted = isMuted;
      video.src = resolvedVideoSrc;
      video.load();

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsVideoPlaying(true);
            stallCountRef.current = 0;
          })
          .catch((err) => {
            console.warn("[BackgroundPromoVideo] Autoplay con audio bloqueado, forzando muted...", err);
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play()
                .then(() => setIsVideoPlaying(true))
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
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, []);

  return (
    <div 
      className="absolute inset-0 z-0 overflow-hidden bg-black select-none pointer-events-auto"
      onClick={onInteract}
    >
      {/* Elemento de video único y persistente */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        preload="auto"
        onEnded={handleVideoEnded}
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
        }}
        className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${
          isVideoPlaying ? "opacity-100" : "opacity-90"
        }`}
      />

      {/* Capa de viñeta oscura translúcida que solo se activa al interactuar para contrastar el PIN pad */}
      <div 
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/65 pointer-events-none transition-opacity duration-700 ease-in-out ${
          showOverlay ? "opacity-100" : "opacity-0"
        }`} 
      />
    </div>
  );
}
