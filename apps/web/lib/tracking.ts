export function getUtmParams(input: string) {
  const url = new URL(input);
  return {
    utm_source: url.searchParams.get("utm_source") || "",
    utm_medium: url.searchParams.get("utm_medium") || "",
    utm_campaign: url.searchParams.get("utm_campaign") || "",
  };
}

export function normalizeSourcePageType(value?: string) {
  const allowed = new Set([
    "photo_page",
    "gallery_page",
    "search",
    "map",
    "homepage",
    "direct",
    "unknown",
  ]);

  if (!value || !allowed.has(value)) return "photo_page";
  return value;
}
