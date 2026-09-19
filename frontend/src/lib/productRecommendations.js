/**
 * Product Recommendations Engine for MC-LARENS ERP
 * - Related products (same brand/category)
 * - Frequently bought together (FBT / Se venden juntos) with manual bundle priority + keyword heuristics
 * 
 * Future extensions (documented as pending per prompt):
 * // P-5: Vehicle compatibility filter (Pending - future phase)
 * // P-7: Cap to ~8 cards and ranking by bundle->stock->subcat (Pending - future phase)
 */

// Heuristic keyword definitions for complementary audio, lighting, electrical & accessory bundles
const FBT_HEURISTICS = [
  {
    triggers: ["midbass", "midrange", "woofer", "coax", "componente", "parlante", "speaker", "pro-gm", "pro-x", "bocina", "medio", "driver", "tweeter"],
    targets: [
      { keywords: ["amplificador", "amp", "4 canal", "4 channel", "4-channel", "4ch", "stereo amp"], weight: 10 },
      { keywords: ["kit de instalacion", "kit cableado", "wiring kit", "calibre 4", "calibre 8", "awg 4", "awg 8", "kit de cables"], weight: 9 },
      { keywords: ["cable rca", "rca", "interconexion", "cable de audio"], weight: 8 },
      { keywords: ["distribuidor de corriente", "portafusible", "bloque distribuidor", "fusible"], weight: 7 },
    ],
  },
  {
    triggers: ["subwoofer", "sub", "bajo", "cajon", "woofer de bajos", "zxi", "elite"],
    targets: [
      { keywords: ["monoblock", "1 canal", "amplificador monoblock", "1-channel", "mono amp", "class d"], weight: 10 },
      { keywords: ["kit cableado", "wiring kit", "calibre 4", "calibre 0", "0 awg", "4 awg", "kit de instalacion"], weight: 9 },
      { keywords: ["caja acustica", "cajon", "caja sellada", "caja porteada"], weight: 8 },
      { keywords: ["restaurador", "epicentro", "procesador de bajos", "epicenter"], weight: 7 },
    ],
  },
  {
    triggers: ["led", "faro", "fog", "neblina", "neblineras", "driving light", "barra led", "spot", "flood", "halo"],
    targets: [
      { keywords: ["switch", "arnes", "relay", "arnes de cableado", "cableado con relay", "interruptor"], weight: 10 },
      { keywords: ["base", "soporte", "bracket", "montura", "abrazadera"], weight: 8 },
      { keywords: ["control remoto", "modulo estroboscopico", "controlador rgb"], weight: 7 },
    ],
  },
  {
    triggers: ["pantalla", "radio", "headunit", "receptor", "receptor multimedia", "carplay", "android auto", "estereo"],
    targets: [
      { keywords: ["camara de retroceso", "camara reversa", "backup camera", "camara"], weight: 10 },
      { keywords: ["arnes", "interfaz de volante", "antena", "adaptador de antena"], weight: 9 },
      { keywords: ["cable rca", "cable usb", "microfono"], weight: 7 },
    ],
  },
  {
    triggers: ["aceite", "lubricante", "optimum plus", "brava", "sintetico", "motul", "valvoline", "liqui moly"],
    targets: [
      { keywords: ["filtro de aceite", "filtro", "oil filter"], weight: 10 },
      { keywords: ["aditivo", "limpiador de motor", "flush", "tratamiento"], weight: 8 },
      { keywords: ["mano de obra", "servicio de cambio de aceite", "cambio de aceite"], weight: 7 },
    ],
  },
];

const normalize = (text) =>
  (text || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Get related products based on same brand and category / subcategory.
 * Excludes the current product.
 * 
 * // P-5: Vehicle compatibility filter (Pending - future phase)
 * // P-7: Cap to ~8 cards and ranking by bundle->stock->subcat (Pending - future phase)
 * 
 * @param {Object} currentProduct 
 * @param {Array} allProducts 
 * @param {Object} options 
 * @returns {Array} List of related products
 */
export function getRelatedProducts(currentProduct, allProducts = [], options = {}) {
  if (!currentProduct || !Array.isArray(allProducts) || allProducts.length === 0) {
    return [];
  }

  const { limit = 12 } = options;
  const currentId = String(currentProduct.product_id || currentProduct.id || currentProduct._id || "");
  const currentSku = normalize(currentProduct.sku);
  const currentBrand = normalize(currentProduct.brand);
  const currentCategory = normalize(currentProduct.category);
  const currentSubcategory = normalize(currentProduct.subcategory);

  const candidates = allProducts.filter((p) => {
    if (!p || p.is_active === false) return false;
    const pId = String(p.product_id || p.id || p._id || "");
    const pSku = normalize(p.sku);
    if (pId && pId === currentId) return false;
    if (pSku && pSku === currentSku) return false;
    return true;
  });

  // Score candidate relevance
  const scored = candidates.map((p) => {
    let score = 0;
    const pBrand = normalize(p.brand);
    const pCategory = normalize(p.category);
    const pSubcategory = normalize(p.subcategory);

    // Same brand match
    if (currentBrand && pBrand === currentBrand) {
      score += 15;
    }

    // Same subcategory match
    if (currentSubcategory && pSubcategory === currentSubcategory) {
      score += 20;
    }

    // Same category match
    if (currentCategory && pCategory === currentCategory) {
      score += 10;
    }

    // Bonus for having image
    if (p.image_url || p.image || (Array.isArray(p.images) && p.images.length > 0)) {
      score += 5;
    }

    return { product: p, score };
  });

  // Filter those that have at least some relation (same brand OR same category)
  const related = scored
    .filter((item) => item.score >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.product);

  return related;
}

/**
 * Get "Frequently Bought Together" (Se venden juntos / Completá el sistema) products.
 * Priority 1: Manual bundles (`bundle_skus` or `bundle_items` on product).
 * Priority 2: Heuristic keyword fill (complementary accessories, amps, wiring, etc.).
 * 
 * If no manual bundles and no heuristic matches exist, returns an empty array (causing section to hide).
 * 
 * // P-5: Vehicle compatibility filter (Pending - future phase)
 * // P-7: Cap to ~8 cards and ranking by bundle->stock->subcat (Pending - future phase)
 * 
 * @param {Object} currentProduct 
 * @param {Array} allProducts 
 * @param {Object} options 
 * @returns {Array} List of bundle item descriptors [{ product, isBundleItem, defaultQty }]
 */
export function getFrequentlyBoughtTogether(currentProduct, allProducts = [], options = {}) {
  if (!currentProduct || !Array.isArray(allProducts) || allProducts.length === 0) {
    return [];
  }

  const { limit = 8 } = options;
  const currentId = String(currentProduct.product_id || currentProduct.id || currentProduct._id || "");
  const currentSku = normalize(currentProduct.sku);

  const lookupBySku = new Map();
  const lookupById = new Map();

  allProducts.forEach((p) => {
    if (!p || p.is_active === false) return;
    const s = normalize(p.sku);
    if (s) lookupBySku.set(s, p);
    const id = String(p.product_id || p.id || p._id || "");
    if (id) lookupById.set(id, p);
  });

  const results = [];
  const addedIds = new Set();
  if (currentId) addedIds.add(currentId);
  if (currentSku) addedIds.add(currentSku);

  // 1. Manual bundle items check (Highest Priority)
  const manualSkus = Array.isArray(currentProduct.bundle_skus)
    ? currentProduct.bundle_skus
    : [];
  const manualItems = Array.isArray(currentProduct.bundle_items)
    ? currentProduct.bundle_items
    : [];

  // Process manual bundle_skus: ["SKU-1", "SKU-2"]
  manualSkus.forEach((skuStr) => {
    const rawSku = normalize(skuStr);
    const prod = lookupBySku.get(rawSku) || lookupById.get(rawSku);
    if (prod) {
      const pId = String(prod.product_id || prod.id || prod._id || prod.sku);
      if (!addedIds.has(pId)) {
        addedIds.add(pId);
        addedIds.add(normalize(prod.sku));
        results.push({
          product: prod,
          isBundleItem: true,
          defaultQty: 1,
        });
      }
    }
  });

  // Process manual bundle_items: [{ sku: "SKU-1", qty: 1 }]
  manualItems.forEach((item) => {
    const rawSku = normalize(item.sku || item.product_id);
    const prod = lookupBySku.get(rawSku) || lookupById.get(rawSku);
    if (prod) {
      const pId = String(prod.product_id || prod.id || prod._id || prod.sku);
      if (!addedIds.has(pId)) {
        addedIds.add(pId);
        addedIds.add(normalize(prod.sku));
        results.push({
          product: prod,
          isBundleItem: true,
          defaultQty: item.qty || item.quantity || 1,
        });
      }
    }
  });

  // If manual bundles satisfy the limit, return them immediately
  if (results.length >= limit) {
    return results.slice(0, limit);
  }

  // 2. Heuristic Keywords Fill (Complementary accessories)
  const searchText = normalize(
    `${currentProduct.name || ""} ${currentProduct.description || ""} ${currentProduct.category || ""} ${currentProduct.subcategory || ""} ${currentProduct.sku || ""}`
  );

  // Find which heuristic rules trigger for this product
  const activeTargets = [];
  FBT_HEURISTICS.forEach((rule) => {
    const matched = rule.triggers.some((trig) => searchText.includes(trig));
    if (matched) {
      activeTargets.push(...rule.targets);
    }
  });

  if (activeTargets.length > 0) {
    const candidateMatches = [];

    allProducts.forEach((p) => {
      if (!p || p.is_active === false) return;
      const pId = String(p.product_id || p.id || p._id || "");
      const pSku = normalize(p.sku);
      if (addedIds.has(pId) || addedIds.has(pSku)) return;

      const pText = normalize(
        `${p.name || ""} ${p.description || ""} ${p.category || ""} ${p.subcategory || ""} ${p.sku || ""}`
      );

      let highestScore = 0;
      activeTargets.forEach((target) => {
        const matchesTarget = target.keywords.some((kw) => pText.includes(kw));
        if (matchesTarget) {
          let score = target.weight;
          // Prefer same brand if both are audio / electronics
          if (currentProduct.brand && normalize(p.brand) === normalize(currentProduct.brand)) {
            score += 5;
          }
          if (score > highestScore) {
            highestScore = score;
          }
        }
      });

      if (highestScore > 0) {
        candidateMatches.push({ product: p, score: highestScore });
      }
    });

    candidateMatches.sort((a, b) => b.score - a.score);

    for (const item of candidateMatches) {
      if (results.length >= limit) break;
      const pId = String(item.product.product_id || item.product.id || item.product._id || item.product.sku);
      if (!addedIds.has(pId)) {
        addedIds.add(pId);
        results.push({
          product: item.product,
          isBundleItem: false,
          defaultQty: 1,
        });
      }
    }
  }

  return results;
}
