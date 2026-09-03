import axios from "axios";
import { API_BASE as API } from "@/lib/api";

const PROMO_VIDEO_CACHE_NAME = "mclarens-promo-cache-v2";

export const DEFAULT_PROMOTIONAL_VIDEOS = [
  // Videos Horizontales y Universales (Catálogo Oficial de Fábrica)
  {
    id: "fox-raptor",
    title: "Ford Gen 3 Raptor - FOX Factory Race Series",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Ford-Gen-3-Raptor-FOX-Factory-Race-Serie_Media_Lb9K-TsubZ8_001_1080p.mp4",
    url: "/videos/promos/YTDown.com_YouTube_Ford-Gen-3-Raptor-FOX-Factory-Race-Serie_Media_Lb9K-TsubZ8_001_1080p.mp4",
    active: true,
  },
  {
    id: "auxbeam-master-t",
    title: "Auxbeam MASTER T-Series 3 Flood Beam",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Auxbeam-MASTER-T-Series-3-Flood-Beam-Off_Media_E25hxrZjQ_g_001_1080p.mp4",
    url: "/videos/promos/YTDown.com_YouTube_Auxbeam-MASTER-T-Series-3-Flood-Beam-Off_Media_E25hxrZjQ_g_001_1080p.mp4",
    active: true,
  },
  {
    id: "rigid-industries",
    title: "Rigid Industries LED Lighting Built to Last",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Rigid-Industries-LED-Lighting-Built-to-b_Media_8rkTz-3j2wg_001_1080p.mp4",
    url: "/videos/promos/YTDown.com_YouTube_Rigid-Industries-LED-Lighting-Built-to-b_Media_8rkTz-3j2wg_001_1080p.mp4",
    active: true,
  },
  {
    id: "fox-4runner",
    title: "Toyota 4Runner - FOX Factory Race Series",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Toyota-4Runner-FOX-Factory-Race-Series_Media_H-WlSQ1Tpjc_001_1080p.mp4",
    url: "/videos/promos/YTDown.com_YouTube_Toyota-4Runner-FOX-Factory-Race-Series_Media_H-WlSQ1Tpjc_001_1080p.mp4",
    active: true,
  },
  {
    id: "auxbeam-v-ultra-3",
    title: "Auxbeam V-ULTRA Series 3-Inch 108W LED",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-3-Inch-108W-LED-S_Media_EYKj2Gx4Zh0_001_1080p.mp4",
    url: "/videos/promos/YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-3-Inch-108W-LED-S_Media_EYKj2Gx4Zh0_001_1080p.mp4",
    active: true,
  },
  {
    id: "fox-victory",
    title: "FOX - Your Victory Is Our Victory",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Your-Victory-Is-Our-Victory-FOX_Media_RY7TCZJ9ruY_001_1080p.mp4",
    url: "/videos/promos/YTDown.com_YouTube_Your-Victory-Is-Our-Victory-FOX_Media_RY7TCZJ9ruY_001_1080p.mp4",
    active: true,
  },
  {
    id: "this-is-rigid",
    title: "This is RIGID Industries",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_This-is-RIGID_Media_Cg2OX_e10mk_001_1080p.mp4",
    url: "/videos/promos/YTDown.com_YouTube_This-is-RIGID_Media_Cg2OX_e10mk_001_1080p.mp4",
    active: true,
  },
  {
    id: "auxbeam-v-ultra-5",
    title: "Auxbeam V-ULTRA Series 5-Inch 172W LED",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-5-Inch-172W-LED-S_Media_BrU095An_Oc_001_1080p.mp4",
    url: "/videos/promos/YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-5-Inch-172W-LED-S_Media_BrU095An_Oc_001_1080p.mp4",
    active: true,
  },
  {
    id: "auxbeam-side-shooter",
    title: "Auxbeam V-ULTRA Series LED Side Shooter",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-LED-Side-Shooter-_Media_s2zY0QzAtxc_001_1080p.mp4",
    url: "/videos/promos/YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-LED-Side-Shooter-_Media_s2zY0QzAtxc_001_1080p.mp4",
    active: true,
  },
  {
    id: "bfgoodrich-ko3-kyle-strait",
    title: "BFGoodrich All-Terrain T/A KO3 Tire - Kyle Strait",
    orientation: "horizontal",
    filename: "bfgoodrich_ko3_kyle_strait.mp4",
    url: "/videos/promos/bfgoodrich_ko3_kyle_strait.mp4",
    active: true,
  },
  {
    id: "bfgoodrich-ko3-tech-overview",
    title: "BFGoodrich KO3 Tire Tech Overview",
    orientation: "horizontal",
    filename: "bfgoodrich_ko3_tech_overview.mp4",
    url: "/videos/promos/bfgoodrich_ko3_tech_overview.mp4",
    active: true,
  },
  {
    id: "ds18-audio-experiment",
    title: "DS18 Audio - The Experiment",
    orientation: "horizontal",
    filename: "ds18_audio_the_experiment.mp4",
    url: "/videos/promos/ds18_audio_the_experiment.mp4",
    active: true,
  },
  {
    id: "bfgoodrich-ko2-gravity",
    title: "BFGoodrich KO2 Takes On Gravity",
    orientation: "horizontal",
    filename: "bfgoodrich_ko2_takes_on_gravity.mp4",
    url: "/videos/promos/bfgoodrich_ko2_takes_on_gravity.mp4",
    active: true,
  },
  {
    id: "mickey-thompson-baja-boss",
    title: "Mickey Thompson Colombia - Baja Boss A/T",
    orientation: "horizontal",
    filename: "mickey_thompson_baja_boss_at.mp4",
    url: "/videos/promos/mickey_thompson_baja_boss_at.mp4",
    active: true,
  },
  {
    id: "bfgoodrich-trail-terrain",
    title: "The BFGoodrich Trail-Terrain T/A Tire Shanty",
    orientation: "horizontal",
    filename: "bfgoodrich_trail_terrain_shanty.mp4",
    url: "/videos/promos/bfgoodrich_trail_terrain_shanty.mp4",
    active: true,
  },
  {
    id: "dakar-2024-rally",
    title: "The World's Toughest Rally - Dakar 2024",
    orientation: "horizontal",
    filename: "dakar_2024_toughest_rally.mp4",
    url: "/videos/promos/dakar_2024_toughest_rally.mp4",
    active: true,
  },
  {
    id: "mickey-thompson-trail-rough",
    title: "Mickey Thompson - When the Trail Gets Rough",
    orientation: "horizontal",
    filename: "mickey_thompson_trail_rough_baja_boss.mp4",
    url: "/videos/promos/mickey_thompson_trail_rough_baja_boss.mp4",
    active: true,
  },
];

const blobUrlMap = new Map();

/**
 * Detecta si el dispositivo es un Smart TV, Kiosco o dispositivo de memoria limitada (<= 4GB RAM)
 * para evitar colapso de RAM por carga de Blobs pesados.
 */
export function isLowMemoryOrSmartTVDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  
  const ua = (navigator.userAgent || "").toLowerCase();
  
  const tvPatterns = [
    "smart-tv", "smarttv", "googletv", "android tv", "appletv", "crkey", "tizen", "webos",
    "hbbtv", "opera tv", "netcast", "viera", "bravia", "roku", "hisense", "philips",
    "sharp", "toshiba", "panasonic", "vestel", "kylo", "aosp on", "large screen", "pov_tv", "aft"
  ];
  if (tvPatterns.some((pattern) => ua.includes(pattern))) {
    return true;
  }

  // Si el navegador reporta memoria reducida (<= 4GB)
  if (navigator.deviceMemory && navigator.deviceMemory <= 4) {
    return true;
  }

  // Modo ahorro de datos o conexiones móviles
  if (navigator.connection && (navigator.connection.saveData || navigator.connection.effectiveType === "2g" || navigator.connection.effectiveType === "3g")) {
    return true;
  }

  return false;
}

/**
 * Obtiene la URL optimizada para reproducción.
 * En Smart TVs y dispositivos de memoria reducida, devuelve la URL HTTP directa para streaming nativo por hardware.
 */
export async function getCachedVideoPlaybackUrl(videoUrl) {
  if (!videoUrl) return "";

  // En Smart TVs y dispositivos con memoria limitada, usar streaming HTTP nativo directo
  // Esto evita cargar archivos de 45MB a memoria RAM / Blobs, permitiendo reproducción infinita sin pantalla negra.
  if (isLowMemoryOrSmartTVDevice()) {
    return videoUrl;
  }

  if (blobUrlMap.has(videoUrl)) {
    return blobUrlMap.get(videoUrl);
  }

  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open(PROMO_VIDEO_CACHE_NAME);
      const match = await cache.match(videoUrl);
      if (match) {
        const blob = await match.blob();
        const objUrl = URL.createObjectURL(blob);
        // Limitar tamaño de mapa para evitar leaks en escritorio
        if (blobUrlMap.size > 3) {
          const firstKey = blobUrlMap.keys().next().value;
          const oldUrl = blobUrlMap.get(firstKey);
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          blobUrlMap.delete(firstKey);
        }
        blobUrlMap.set(videoUrl, objUrl);
        return objUrl;
      }
    } catch (_) {}
  }

  return videoUrl;
}

/**
 * Precarga y almacena en caché local del navegador de forma segura.
 * Se omite en Smart TVs para no agotar la memoria del dispositivo.
 */
export async function prefetchPromotionalVideos(videoList) {
  if (typeof window === "undefined" || !("caches" in window) || !Array.isArray(videoList)) return;
  if (isLowMemoryOrSmartTVDevice()) return; // Smart TVs transmiten directamente

  try {
    const cache = await caches.open(PROMO_VIDEO_CACHE_NAME);
    const activeUrls = new Set(videoList.map((v) => v.url).filter(Boolean));

    // Limpiar videos antiguos o eliminados de la caché local del navegador
    const requests = await cache.keys();
    for (const req of requests) {
      const reqPath = new URL(req.url, window.location.origin).pathname;
      const isStillActive = activeUrls.has(req.url) || activeUrls.has(reqPath);
      if (!isStillActive) {
        await cache.delete(req);
      }
    }

    // Precargar solo los primeros 2 videos para evitar saturar ancho de banda
    for (const item of videoList.slice(0, 2)) {
      if (!item?.url) continue;
      const match = await cache.match(item.url);
      if (!match) {
        fetch(item.url)
          .then(async (res) => {
            if (res.ok) {
              await cache.put(item.url, res);
            }
          })
          .catch(() => {});
      }
    }
  } catch (_) {}
}

export async function fetchPromotionalVideos(branchId = "") {
  try {
    const branch = branchId || (typeof window !== "undefined" ? localStorage.getItem("preferred_branch_id") || localStorage.getItem("sucursal") || "" : "");
    const url = branch ? `${API}/promos/videos?branch_id=${encodeURIComponent(branch)}` : `${API}/promos/videos`;
    const response = await axios.get(url);
    if (Array.isArray(response?.data?.videos)) {
      prefetchPromotionalVideos(response.data.videos);
      return response.data.videos;
    }
  } catch (_) {
    // Fallback a lista estática
  }
  prefetchPromotionalVideos(DEFAULT_PROMOTIONAL_VIDEOS);
  return DEFAULT_PROMOTIONAL_VIDEOS;
}

/**
 * Resuelve el logo y marca correspondiente al video que se está reproduciendo.
 */
export function getBrandInfoForVideo(video) {
  if (!video) return {
    brand: "Mc-LarenS",
    logo: "/brands/mclarens-white-red.png",
    theme: "mclarens",
  };
  
  const text = `${video.brand || ""} ${video.title || ""} ${video.filename || ""} ${video.id || ""}`.toLowerCase();

  if (text.includes("auxbeam")) {
    return {
      brand: "Auxbeam",
      logo: "/brands/auxbeam-brand-logo.png",
      theme: "auxbeam",
      accent: "#EE8B13",
    };
  }
  if (text.includes("fox")) {
    return {
      brand: "FOX",
      logo: "/brands/fox-brand-logo.png",
      theme: "fox",
      accent: "#E4511D",
    };
  }
  if (text.includes("rigid")) {
    return {
      brand: "Rigid Industries",
      logo: "/brands/rigid-brand-logo.png",
      theme: "rigid",
      accent: "#E20725",
    };
  }
  if (text.includes("solar") || text.includes("gard")) {
    return {
      brand: "Solar Gard",
      logo: "/brands/solargard-brand-logo.png",
      theme: "solargard",
      accent: "#00AED9",
    };
  }
  if (text.includes("ds18")) {
    return {
      brand: "DS18",
      logo: "/brands/ds18-brand-logo.png",
      theme: "ds18",
      accent: "#E20725",
    };
  }
  if (text.includes("keko")) {
    return {
      brand: "Keko",
      logo: "/brands/keko-brand-logo.png",
      theme: "keko",
      accent: "#EA6E29",
    };
  }
  if (text.includes("autobull")) {
    return {
      brand: "AutoBull",
      logo: "/brands/autobull-brand-logo.png",
      theme: "autobull",
      accent: "#D4AF37",
    };
  }
  if (text.includes("afn")) {
    return {
      brand: "AFN 4x4",
      logo: "/brands/afn-brand-logo.png",
      theme: "afn",
      accent: "#B91C1C",
    };
  }
  if (text.includes("totem") || text.includes("mundo")) {
    return {
      brand: "Mundo de Accesorios",
      logo: "/brands/mundo-accesorios-brand-logo.png",
      theme: "mundo",
      accent: "#38BDF8",
    };
  }
  if (text.includes("bfgoodrich") || text.includes("ko2") || text.includes("ko3") || text.includes("trail-terrain") || text.includes("terrain")) {
    return {
      brand: "BFGoodrich",
      logo: "/brands/mclarens-white-red.png",
      theme: "bfgoodrich",
      accent: "#E20725",
    };
  }
  if (text.includes("mickey") || text.includes("thompson") || text.includes("baja boss")) {
    return {
      brand: "Mickey Thompson",
      logo: "/brands/mclarens-white-red.png",
      theme: "mickeythompson",
      accent: "#EAB308",
    };
  }
  if (text.includes("dakar") || text.includes("rally")) {
    return {
      brand: "Dakar Rally",
      logo: "/brands/mclarens-white-red.png",
      theme: "dakar",
      accent: "#F97316",
    };
  }

  return {
    brand: "Mc-LarenS",
    logo: "/brands/mclarens-white-red.png",
    theme: "mclarens",
    accent: "#EF2D2D",
  };
}
