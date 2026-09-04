import axios from "axios";
import { API_BASE as API } from "@/lib/api";

const GCS_PROMO_VIDEOS_BASE = "https://storage.googleapis.com/mclarens-erp-vehicles/videos/promos";

/**
 * Resuelve cualquier URL relativa o de subida directamente a la URL pública absoluta
 * de Google Cloud Storage CDN. Esto evita respuestas de redirección HTTP 307 que
 * hacen fallar a los reproductores de Smart TVs (Tizen, WebOS, Android TV).
 */
export function resolveDirectPromoVideoUrl(videoUrl) {
  if (!videoUrl) return "";
  if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
    return videoUrl;
  }
  const cleanFilename = videoUrl.split("/").pop().split("?")[0];
  if (cleanFilename) {
    return `${GCS_PROMO_VIDEOS_BASE}/${cleanFilename}`;
  }
  return videoUrl;
}

export const DEFAULT_PROMOTIONAL_VIDEOS = [
  // Videos Horizontales y Universales (Catálogo Oficial de Fábrica - 19 Videos Verificados en GCS)
  {
    id: "fox-raptor",
    title: "Ford Gen 3 Raptor - FOX Factory Race Series",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Ford-Gen-3-Raptor-FOX-Factory-Race-Serie_Media_Lb9K-TsubZ8_001_1080p.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/YTDown.com_YouTube_Ford-Gen-3-Raptor-FOX-Factory-Race-Serie_Media_Lb9K-TsubZ8_001_1080p.mp4`,
    active: true,
    sort_order: 1,
  },
  {
    id: "auxbeam-master-t",
    title: "Auxbeam MASTER T-Series 3 Flood Beam",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Auxbeam-MASTER-T-Series-3-Flood-Beam-Off_Media_E25hxrZjQ_g_001_1080p.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/YTDown.com_YouTube_Auxbeam-MASTER-T-Series-3-Flood-Beam-Off_Media_E25hxrZjQ_g_001_1080p.mp4`,
    active: true,
    sort_order: 2,
  },
  {
    id: "rigid-industries",
    title: "Rigid Industries LED Lighting Built to Last",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Rigid-Industries-LED-Lighting-Built-to-b_Media_8rkTz-3j2wg_001_1080p.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/YTDown.com_YouTube_Rigid-Industries-LED-Lighting-Built-to-b_Media_8rkTz-3j2wg_001_1080p.mp4`,
    active: true,
    sort_order: 3,
  },
  {
    id: "fox-4runner",
    title: "Toyota 4Runner - FOX Factory Race Series",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Toyota-4Runner-FOX-Factory-Race-Series_Media_H-WlSQ1Tpjc_001_1080p.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/YTDown.com_YouTube_Toyota-4Runner-FOX-Factory-Race-Series_Media_H-WlSQ1Tpjc_001_1080p.mp4`,
    active: true,
    sort_order: 4,
  },
  {
    id: "auxbeam-v-ultra-3",
    title: "Auxbeam V-ULTRA Series 3-Inch 108W LED",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-3-Inch-108W-LED-S_Media_EYKj2Gx4Zh0_001_1080p.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-3-Inch-108W-LED-S_Media_EYKj2Gx4Zh0_001_1080p.mp4`,
    active: true,
    sort_order: 5,
  },
  {
    id: "fox-victory",
    title: "FOX - Your Victory Is Our Victory",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Your-Victory-Is-Our-Victory-FOX_Media_RY7TCZJ9ruY_001_1080p.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/YTDown.com_YouTube_Your-Victory-Is-Our-Victory-FOX_Media_RY7TCZJ9ruY_001_1080p.mp4`,
    active: true,
    sort_order: 6,
  },
  {
    id: "this-is-rigid",
    title: "This is RIGID Industries",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_This-is-RIGID_Media_Cg2OX_e10mk_001_1080p.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/YTDown.com_YouTube_This-is-RIGID_Media_Cg2OX_e10mk_001_1080p.mp4`,
    active: true,
    sort_order: 7,
  },
  {
    id: "auxbeam-v-ultra-5",
    title: "Auxbeam V-ULTRA Series 5-Inch 172W LED",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-5-Inch-172W-LED-S_Media_BrU095An_Oc_001_1080p.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-5-Inch-172W-LED-S_Media_BrU095An_Oc_001_1080p.mp4`,
    active: true,
    sort_order: 8,
  },
  {
    id: "auxbeam-side-shooter",
    title: "Auxbeam V-ULTRA Series LED Side Shooter",
    orientation: "horizontal",
    filename: "YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-LED-Side-Shooter-_Media_s2zY0QzAtxc_001_1080p.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/YTDown.com_YouTube_Auxbeam-V-ULTRA-Series-LED-Side-Shooter-_Media_s2zY0QzAtxc_001_1080p.mp4`,
    active: true,
    sort_order: 9,
  },
  {
    id: "bfgoodrich-ko3-kyle-strait",
    title: "BFGoodrich All-Terrain T/A KO3 Tire - Kyle Strait",
    orientation: "horizontal",
    filename: "bfgoodrich_ko3_kyle_strait.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/bfgoodrich_ko3_kyle_strait.mp4`,
    active: true,
    sort_order: 10,
  },
  {
    id: "bfgoodrich-ko3-tech-overview",
    title: "BFGoodrich KO3 Tire Tech Overview",
    orientation: "horizontal",
    filename: "bfgoodrich_ko3_tech_overview.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/bfgoodrich_ko3_tech_overview.mp4`,
    active: true,
    sort_order: 11,
  },
  {
    id: "ds18-audio-experiment",
    title: "DS18 Audio - The Experiment",
    orientation: "horizontal",
    filename: "ds18_audio_the_experiment.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/ds18_audio_the_experiment.mp4`,
    active: true,
    sort_order: 12,
  },
  {
    id: "bfgoodrich-ko2-gravity",
    title: "BFGoodrich KO2 Takes On Gravity",
    orientation: "horizontal",
    filename: "bfgoodrich_ko2_takes_on_gravity.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/bfgoodrich_ko2_takes_on_gravity.mp4`,
    active: true,
    sort_order: 13,
  },
  {
    id: "mickey-thompson-baja-boss",
    title: "Mickey Thompson Colombia - Baja Boss A/T",
    orientation: "horizontal",
    filename: "mickey_thompson_baja_boss_at.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/mickey_thompson_baja_boss_at.mp4`,
    active: true,
    sort_order: 14,
  },
  {
    id: "bfgoodrich-trail-terrain",
    title: "The BFGoodrich Trail-Terrain T/A Tire Shanty",
    orientation: "horizontal",
    filename: "bfgoodrich_trail_terrain_shanty.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/bfgoodrich_trail_terrain_shanty.mp4`,
    active: true,
    sort_order: 15,
  },
  {
    id: "dakar-2024-rally",
    title: "The World's Toughest Rally - Dakar 2024",
    orientation: "horizontal",
    filename: "dakar_2024_toughest_rally.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/dakar_2024_toughest_rally.mp4`,
    active: true,
    sort_order: 16,
  },
  {
    id: "mickey-thompson-trail-rough",
    title: "Mickey Thompson - When the Trail Gets Rough",
    orientation: "horizontal",
    filename: "mickey_thompson_trail_rough_baja_boss.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/mickey_thompson_trail_rough_baja_boss.mp4`,
    active: true,
    sort_order: 17,
  },
  {
    id: "auxbeam-color-play",
    title: "Auxbeam Color Play Series RGB Offroad Lights",
    orientation: "horizontal",
    filename: "auxbeam_color_play_series_rgb.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/auxbeam_color_play_series_rgb.mp4`,
    active: true,
    sort_order: 18,
  },
  {
    id: "auxbeam-rgb-switch-panel",
    title: "Auxbeam 8 Gang RGB Switch Panel System",
    orientation: "horizontal",
    filename: "auxbeam_rgb_switch_panel_promo.mp4",
    url: `${GCS_PROMO_VIDEOS_BASE}/auxbeam_rgb_switch_panel_promo.mp4`,
    active: true,
    sort_order: 19,
  },
];

/**
 * Detecta si el dispositivo es un Smart TV, Kiosco o dispositivo de memoria limitada (<= 4GB RAM)
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
  if (navigator.deviceMemory && navigator.deviceMemory <= 4) {
    return true;
  }
  return false;
}

/**
 * Obtiene la URL directa para streaming HTTP 206 en Google Cloud Storage CDN.
 * Cero redirecciones 307, cero intermediarios, máxima compatibilidad con Smart TVs.
 */
export async function getCachedVideoPlaybackUrl(videoUrl) {
  return resolveDirectPromoVideoUrl(videoUrl);
}

/**
 * Precarga de lista de videos.
 */
export async function prefetchPromotionalVideos(_videoList) {
  // Direct streaming
}

export async function fetchPromotionalVideos(branchId = "") {
  try {
    const branch = branchId || (typeof window !== "undefined" ? localStorage.getItem("preferred_branch_id") || localStorage.getItem("sucursal") || "" : "");
    const url = branch ? `${API}/promos/videos?branch_id=${encodeURIComponent(branch)}` : `${API}/promos/videos`;
    const response = await axios.get(url);
    if (Array.isArray(response?.data?.videos)) {
      const normalized = response.data.videos.map((v) => ({
        ...v,
        url: resolveDirectPromoVideoUrl(v.url),
      }));
      prefetchPromotionalVideos(normalized);
      return normalized;
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
  if (text.includes("bfgoodrich") || text.includes("ko3") || text.includes("ko2") || text.includes("trail-terrain")) {
    return {
      brand: "BFGoodrich",
      logo: "/brands/bfgoodrich-brand-logo.png",
      theme: "bfgoodrich",
      accent: "#0033A0",
    };
  }
  if (text.includes("mickey") || text.includes("thompson") || text.includes("baja")) {
    return {
      brand: "Mickey Thompson",
      logo: "/brands/mickey-thompson-brand-logo.png",
      theme: "mickey_thompson",
      accent: "#C8102E",
    };
  }
  if (text.includes("ds18")) {
    return {
      brand: "DS18 Audio",
      logo: "/brands/ds18-brand-logo.png",
      theme: "ds18",
      accent: "#E50000",
    };
  }

  return {
    brand: "Mc-LarenS",
    logo: "/brands/mclarens-white-red.png",
    theme: "mclarens",
  };
}
