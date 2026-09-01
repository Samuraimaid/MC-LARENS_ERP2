import axios from "axios";
import { API_BASE as API } from "@/lib/api";

const PROMO_VIDEO_CACHE_NAME = "mclarens-promo-cache-v2";

export const DEFAULT_PROMOTIONAL_VIDEOS = [
  // Videos Verticales (Tótem / Móvil / Pantallas verticales)
  {
    id: "totem-1",
    title: "Mundo de Accesorios Totem 1",
    orientation: "vertical",
    filename: "totem1-1.mp4",
    url: "/videos/promos/totem1-1.mp4",
    active: true,
  },
  {
    id: "totem-2",
    title: "Mundo de Accesorios Totem 2",
    orientation: "vertical",
    filename: "totem2-1.mp4",
    url: "/videos/promos/totem2-1.mp4",
    active: true,
  },

  // Videos Horizontales (Widescreen / TV / Pantallas horizontales)
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
];

const blobUrlMap = new Map();

/**
 * Obtiene la URL optimizada para reproducción (desde blob cache local si está disponible).
 */
export async function getCachedVideoPlaybackUrl(videoUrl) {
  if (!videoUrl) return "";
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
        blobUrlMap.set(videoUrl, objUrl);
        return objUrl;
      }

      // Descargar en segundo plano y almacenar en CacheStorage
      fetch(videoUrl)
        .then(async (res) => {
          if (res.ok) {
            await cache.put(videoUrl, res.clone());
            const b = await res.blob();
            const created = URL.createObjectURL(b);
            blobUrlMap.set(videoUrl, created);
          }
        })
        .catch(() => {});
    } catch (_) {}
  }

  return videoUrl;
}

/**
 * Precarga y almacena en caché local del navegador todos los videos de la lista.
 */
export async function prefetchPromotionalVideos(videoList) {
  if (typeof window === "undefined" || !("caches" in window) || !Array.isArray(videoList)) return;
  try {
    const cache = await caches.open(PROMO_VIDEO_CACHE_NAME);
    for (const item of videoList) {
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
    if (Array.isArray(response?.data?.videos) && response.data.videos.length > 0) {
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
      accent: "#F59E0B",
    };
  }
  if (text.includes("fox")) {
    return {
      brand: "FOX",
      logo: "/brands/fox-brand-logo.png",
      theme: "fox",
      accent: "#EA580C",
    };
  }
  if (text.includes("rigid")) {
    return {
      brand: "Rigid Industries",
      logo: "/brands/rigid-brand-logo.png",
      theme: "rigid",
      accent: "#DC2626",
    };
  }
  if (text.includes("solar") || text.includes("gard")) {
    return {
      brand: "Solar Gard",
      logo: "/brands/solargard-brand-logo.png",
      theme: "solargard",
      accent: "#0284C7",
    };
  }
  if (text.includes("ds18")) {
    return {
      brand: "DS18",
      logo: "/brands/ds18-brand-logo.png",
      theme: "ds18",
      accent: "#E11D48",
    };
  }
  if (text.includes("keko")) {
    return {
      brand: "Keko",
      logo: "/brands/keko-brand-logo.png",
      theme: "keko",
      accent: "#16A34A",
    };
  }
  if (text.includes("autobull")) {
    return {
      brand: "AutoBull",
      logo: "/brands/autobull-brand-logo.png",
      theme: "autobull",
      accent: "#CA8A04",
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

  return {
    brand: "Mc-LarenS",
    logo: "/brands/mclarens-white-red.png",
    theme: "mclarens",
    accent: "#EF4444",
  };
}
