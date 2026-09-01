import React, { useState, useEffect, useRef, useMemo } from "react";
import { DEFAULT_PROMOTIONAL_VIDEOS, fetchPromotionalVideos, getCachedVideoPlaybackUrl, prefetchPromotionalVideos } from "@/lib/promoVideos";

export default function BackgroundPromoVideo({
  isPortrait = false,
  isMuted = true,
  onInteract,
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

  // Filtrar videos según orientación (vertical para tótem, horizontal para widescreen)
  const activePlaylist = useMemo(() => {
    const targetOrientation = isPortrait ? "vertical" : "horizontal";
    const filtered = videos.filter(
      (v) => (v.active !== false) && (v.orientation === targetOrientation || !v.orientation)
    );
    if (filtered.length > 0) return filtered;
    return videos.filter((v) => v.active !== false);
  }, [videos, isPortrait]);

  // Si cambia la orientación o la playlist, resetear índice seguro
  useEffect(() => {
    setCurrentIndex(0);
  }, [isPortrait, activePlaylist.length]);

  const currentVideo = activePlaylist[currentIndex] || activePlaylist[0] || DEFAULT_PROMOTIONAL_VIDEOS[0];

  // Resolver URL desde caché local para carga instantánea sin latencia
  useEffect(() => {
    let cancelled = false;
    if (currentVideo?.url) {
      getCachedVideoPlaybackUrl(currentVideo.url).then((src) => {
        if (!cancelled && src) {
          setResolvedVideoSrc(src);
        }
      });
      // Precargar el siguiente video en la lista
      const nextIdx = (currentIndex + 1) % activePlaylist.length;
      const nextVideo = activePlaylist[nextIdx];
      if (nextVideo?.url) {
        getCachedVideoPlaybackUrl(nextVideo.url).catch(() => {});
      }
    }
    return () => {
      cancelled = true;
    };
  }, [currentVideo?.url, currentIndex, activePlaylist]);

  const handleVideoEnded = () => {
    setCurrentIndex((prev) => (prev + 1) % activePlaylist.length);
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
