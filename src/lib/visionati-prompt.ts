/**
 * Visionati system prompt and user-prompt builder for WildPhotography editorial descriptions.
 * All prompting logic lives here — keep visionati-client.ts focused on HTTP only.
 */

export const VISIONATI_SYSTEM_PROMPT = `
You are writing a polished editorial nature and travel photo description for WildPhotography.

Write one description of 80 to 120 words in clear natural English.

Goal:
Produce a vivid but factual description suitable for a public wildlife and travel photography website.

Instructions:
- Describe only what is visually supportable by the image and supplied metadata.
- If metadata includes a common name, scientific name, or location, incorporate them naturally when relevant.
- If the exact species or place is uncertain, do not guess. Use careful wording such as "likely", "appears to", or omit the claim.
- Mention visible habitat, behavior, posture, plumage or coloration, lighting, weather, terrain, or surrounding environment where relevant.
- For wildlife images, include the common name and scientific name only if provided or highly certain from metadata.
- For landscape or travel images, include geographic location only if provided by metadata.
- Avoid keyword stuffing, hype, exclamation points, and sales language.
- Avoid repeating the filename, slug, or generic phrases like "this image shows".
- Output a single paragraph only.
`.trim();

export function buildUserPrompt(input: {
  title?: string | null;
  description?: string | null;
  keywords?: string[] | null;
  category?: string | null;
  galleryName?: string | null;
  locationName?: string | null;
  region?: string | null;
  country?: string | null;
  commonName?: string | null;
  scientificName?: string | null;
  cameraModel?: string | null;
  lensModel?: string | null;
  captureDate?: string | null;
  sourcePath?: string | null;
  photoSlug?: string | null;
}): string {
  // Handle keywords as either string or array (DB may return either)
  const rawKw = input.keywords;
  const kw =
    Array.isArray(rawKw)
      ? rawKw.join(", ")
      : typeof rawKw === "string"
        ? rawKw
        : "";
  return `
Photo metadata context:
- title: ${input.title ?? ""}
- existing_description: ${input.description ?? ""}
- keywords: ${kw}
- category: ${input.category ?? ""}
- gallery_name: ${input.galleryName ?? ""}
- location_name: ${input.locationName ?? ""}
- region: ${input.region ?? ""}
- country: ${input.country ?? ""}
- common_name: ${input.commonName ?? ""}
- scientific_name: ${input.scientificName ?? ""}
- camera_model: ${input.cameraModel ?? ""}
- lens_model: ${input.lensModel ?? ""}
- capture_date: ${input.captureDate ?? ""}
- source_path: ${input.sourcePath ?? ""}
- photo_slug: ${input.photoSlug ?? ""}

Write exactly one paragraph in English, 80 to 120 words.
`.trim();
}
