import React, { useState, useEffect, useRef, useMemo } from "react";
import { DEFAULT_PROMOTIONAL_VIDEOS, fetchPromotionalVideos, getCachedVideoPlaybackUrl, prefetchPromotionalVideos } from "@/lib/promoVideos";

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
  const videoRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    fetchPromotionalVideos().then((list) => {
      if (mounted && Array.isArray(list) && list.length > 0) {
        setVideos(list);
        prefetchPromotionalVideos(list);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Filtrar videos según orientación (o permitir videos widescreen en móviles de manera uniforme)
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

  // Si cambia la orientación o la playlist, iniciar con un video aleatorio
  useEffect(() => {
    if (activePlaylist.length > 0) {
      const initialRandom = Math.floor(Math.random() * activePlaylist.length);
      setCurrentIndex(initialRandom);
    }
  }, [isPortrait, activePlaylist.length]);

  const currentVideo = activePlaylist[currentIndex] || activePlaylist[0] || DEFAULT_PROMOTIONAL_VIDEOS[0];

  // Notificar al componente padre sobre el video en reproducción para sincronizar el logo de la marca
  useEffect(() => {
    if (currentVideo && typeof onVideoChange === "function") {
      onVideoChange(currentVideo);
    }
  }, [currentVideo, onVideoChange]);

  // Resolver URL desde caché local para carga instantánea sin latencia
  useEffect(() => {
    let cancelled = false;
    if (currentVideo?.url) {
      getCachedVideoPlaybackUrl(currentVideo.url).then((src) => {
        if (!cancelled && src) {
          setResolvedVideoSrc(src);
        }
      });
      // Precargar otros videos aleatorios de la playlist
      activePlaylist.forEach((v) => {
        if (v?.url && v.url !== currentVideo.url) {
          getCachedVideoPlaybackUrl(v.url).catch(() => {});
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [currentVideo?.url, currentIndex, activePlaylist]);

  // Al terminar un video, reproducir otro video de forma aleatoria (sin repetir el mismo si hay más de 1)
  const handleVideoEnded = () => {
    if (activePlaylist.length <= 1) return;
    setCurrentIndex((prev) => {
      let next;
      let attempts = 0;
      do {
        next = Math.floor(Math.random() * activePlaylist.length);
        attempts++;
      } while (next === prev && activePlaylist.length > 1 && attempts < 10);
      return next;
    });
  };

  // Sincronizar estado de mute con el elemento de video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (!isMuted) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isMuted]);

  // Asegurar autoplay del video al cambiar de fuente
  useEffect(() => {
    if (videoRef.current && resolvedVideoSrc) {
      videoRef.current.muted = isMuted;
      videoRef.current.play().catch(() => {
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      });
    }
  }, [resolvedVideoSrc]);

  return (
    <div 
      className="absolute inset-0 z-0 overflow-hidden bg-black select-none pointer-events-auto"
      onClick={onInteract}
    >
      {resolvedVideoSrc ? (
        <video
          key={resolvedVideoSrc}
          ref={videoRef}
          src={resolvedVideoSrc}
          autoPlay
          playsInline
          muted={isMuted}
          onEnded={handleVideoEnded}
          className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700"
        />
      ) : null}

      {/* Capa de viñeta oscura translúcida para garantizar contraste del texto */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/55 pointer-events-none" />
    </div>
  );
}
