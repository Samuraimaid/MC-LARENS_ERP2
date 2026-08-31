import axios from "axios";
import { API_BASE as API } from "@/lib/api";

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

export async function fetchPromotionalVideos() {
  try {
    const response = await axios.get(`${API}/promos/videos`);
    if (Array.isArray(response?.data?.videos) && response.data.videos.length > 0) {
      return response.data.videos;
    }
  } catch (_) {
    // Fallback a lista estática
  }
  return DEFAULT_PROMOTIONAL_VIDEOS;
}
