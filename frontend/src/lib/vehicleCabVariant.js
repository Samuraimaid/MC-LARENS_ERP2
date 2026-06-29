export const PICKUP_SLUGS = new Set(["camioneta-1-cabina", "camioneta-cabina-y-media"]);

export const VEHICLE_CAB_VARIANTS = [
  { value: "single", label: "1 cabina", slug: "camioneta-1-cabina" },
  { value: "extended", label: "Cabina y media", slug: "camioneta-cabina-y-media" },
  { value: "double", label: "Doble cabina", slug: "camioneta-cabina-y-media" },
];

const CAB_LABELS = {
  single: "Camioneta 1 Cabina",
  extended: "Camioneta Cabina y Media",
  double: "Camioneta Doble Cabina",
};

export function isPickupSlug(slug) {
  return PICKUP_SLUGS.has(String(slug || "").trim());
}

export function resolveCabVariantPayload(baseSlug, cabVariant) {
  if (!isPickupSlug(baseSlug) || !cabVariant) return null;
  const profile = VEHICLE_CAB_VARIANTS.find((item) => item.value === cabVariant);
  if (!profile) return null;
  return {
    vehicle_type_slug: profile.slug,
    thumbnail_slug: profile.slug,
    vehicle_type: CAB_LABELS[cabVariant] || profile.label,
    vehicle_cab_variant: cabVariant,
  };
}