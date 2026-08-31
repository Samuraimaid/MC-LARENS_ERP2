import React, { useState, useEffect, useRef, useMemo } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_PROMOTIONAL_VIDEOS, fetchPromotionalVideos } from "@/lib/promoVideos";

export default function BackgroundPromoVideo({
  isPortrait = false,
  onInteract,
}) {
  const [videos, setVideos] = useState(DEFAULT_PROMOTIONAL_VIDEOS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    fetchPromotionalVideos().then((list) => {
      if (mounted && Array.isArray(list) && list.length > 0) {
        setVideos(list);
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

  const handleVideoEnded = () => {
    setCurrentIndex((prev) => (prev + 1) % activePlaylist.length);
  };

  const toggleAudio = (e) => {
    e.stopPropagation();
    if (onInteract) onInteract();
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.muted = next;
        if (!next) {
          videoRef.current.play().catch(() => {});
        }
      }
      return next;
    });
  };

  // Asegurar que el video intente reproducir automáticamente
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.play().catch(() => {
        // En navegadores estrictos, silenciar y reintentar
        if (videoRef.current) {
          videoRef.current.muted = true;
          setIsMuted(true);
          videoRef.current.play().catch(() => {});
        }
      });
    }
  }, [currentVideo?.url]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black select-none pointer-events-auto">
      {currentVideo?.url ? (
        <video
          key={currentVideo.url}
          ref={videoRef}
          src={currentVideo.url}
          autoPlay
          playsInline
          muted={isMuted}
          onEnded={handleVideoEnded}
          className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700"
        />
      ) : null}

      {/* Capa de viñeta oscura translúcida para garantizar contraste del texto */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/50 pointer-events-none" />

      {/* Botón flotante para activar / desactivar sonido */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleAudio}
          className="h-10 px-3.5 rounded-full bg-black/40 hover:bg-black/60 border-white/20 text-white backdrop-blur-md transition-all shadow-lg flex items-center gap-2 group"
          title={isMuted ? "Activar audio" : "Silenciar video"}
        >
          {isMuted ? (
            <>
              <VolumeX className="h-4 w-4 text-red-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-white/90 hidden sm:inline">Mudo</span>
            </>
          ) : (
            <>
              <Volume2 className="h-4 w-4 text-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-white/90 hidden sm:inline">Audio Activado</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
