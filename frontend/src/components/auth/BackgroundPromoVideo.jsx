import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  DEFAULT_PROMOTIONAL_VIDEOS, 
  fetchPromotionalVideos, 
  getCachedVideoPlaybackUrl, 
  prefetchPromotionalVideos,
  isLowMemoryOrSmartTVDevice 
} from "@/lib/promoVideos";

export default function BackgroundPromoVideo({
  isPortrait = false,
  isMuted = true,
  onInteract,
  onVideoChange,
  allowWidescreenOnMobile = true,
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

  // 2. Playlist activa según orientación de pantalla
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

  // Iniciar con un video aleatorio al montar o cambiar playlist
  useEffect(() => {
    if (activePlaylist.length > 0) {
      const initialRandom = Math.floor(Math.random() * activePlaylist.length);
      setCurrentIndex(initialRandom);
    }
  }, [isPortrait, activePlaylist.length]);

  const currentVideo = activePlaylist[currentIndex] || activePlaylist[0] || DEFAULT_PROMOTIONAL_VIDEOS[0];

  // 3. Notificar al componente padre para sincronizar marca y logotipo
  useEffect(() => {
    if (currentVideo && typeof onVideoChange === "function") {
      onVideoChange(currentVideo);
    }
  }, [currentVideo, onVideoChange]);

  // 4. Cambiar al siguiente video de forma segura
  const handleVideoEnded = useCallback(() => {
    if (activePlaylist.length <= 1) {
      // Si solo hay 1 video, rebobinar y reproducir de nuevo
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
      return;
    }

    setCurrentIndex((prev) => {
      let next;
      let attempts = 0;
      do {
        next = Math.floor(Math.random() * activePlaylist.length);
        attempts++;
      } while (next === prev && activePlaylist.length > 1 && attempts < 10);
      return next;
    });
  }, [activePlaylist]);

  // 5. Resolver URL optimizada (Streaming directo en Smart TVs para no colapsar la RAM)
  useEffect(() => {
    let cancelled = false;
    if (currentVideo?.url) {
      getCachedVideoPlaybackUrl(currentVideo.url).then((src) => {
        if (!cancelled && src) {
          setResolvedVideoSrc(src);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [currentVideo?.url, currentIndex]);

  // 6. Carga y reproducción segura en un solo elemento <video> estable (Evita pantalla negra por bloqueo de hardware)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedVideoSrc) return;

    setIsVideoPlaying(false);

    try {
      video.muted = isMuted;
      video.pause();
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
            console.warn("[BackgroundPromoVideo] Autoplay mitigado, forzando muted...", err);
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
  }, [resolvedVideoSrc, isMuted]);

  // 7. Sincronizar estado de mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (!isMuted && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isMuted]);

  // 8. Watchdog inteligente anti-pantalla negra para Smart TVs
  // Si el decodificador de la TV se congela o no avanza el tiempo por más de 6 segundos, salta al siguiente video automáticamente
  useEffect(() => {
    const isTV = isLowMemoryOrSmartTVDevice();
    const intervalMs = isTV ? 3000 : 5000;

    const interval = setInterval(() => {
      const v = videoRef.current;
      if (!v || !resolvedVideoSrc) return;

      if (!v.paused && !v.ended) {
        if (Math.abs(v.currentTime - lastTimeRef.current) < 0.1) {
          stallCountRef.current += 1;
          // Si el video está congelado en una pantalla negra por más de 6s
          if (stallCountRef.current >= 2) {
            console.warn("[BackgroundPromoVideo Watchdog] Video congelado en decodificador TV, recuperando...");
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
      {/* Elemento de video único y persistente (evita destruir el plano de hardware en Smart TVs) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        preload="auto"
        onEnded={handleVideoEnded}
        onError={(e) => {
          console.warn("[BackgroundPromoVideo] Error de decodificación o red en Smart TV, avanzando al siguiente video...", e);
          if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
          transitionTimeoutRef.current = setTimeout(() => {
            handleVideoEnded();
          }, 600);
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

      {/* Capa de viñeta oscura translúcida para garantizar contraste del texto de la hora y logo */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/55 pointer-events-none" />
    </div>
  );
}
