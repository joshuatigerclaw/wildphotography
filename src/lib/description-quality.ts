/**
 * Description quality scoring utilities.
 * Used to decide whether to accept, reject, or promote a generated description.
 */

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function wordCount(value: string): number {
  return normalizeWhitespace(value)
    .split(" ")
    .filter(Boolean).length;
}

export function looksFilenameLike(value: string): boolean {
  return /^(img|dsc|photo|image|pxl|mvimg|whatsapp)[-_ ]?\d+/i.test(value.trim());
}

export function looksGenericWeak(value: string): boolean {
  const v = value.trim().toLowerCase();
  const exactWeak = new Set([
    "untitled",
    "bird",
    "animal",
    "landscape",
    "nature",
    "nice photo",
    "photo",
    "image",
    "bird in tree",
  ]);
  if (exactWeak.has(v)) return true;
  if (looksFilenameLike(v)) return true;
  if (v.length < 40) return true;
  return false;
}

export function isStrongDescription(
  value: string | null | undefined
): boolean {
  if (!value) return false;
  const clean = normalizeWhitespace(value);
  const wc = wordCount(clean);
  if (wc < 80) return false;
  if (looksFilenameLike(clean)) return false;
  if (clean.length < 350) return false;
  return true;
}

export function isWeakDescription(
  value: string | null | undefined
): boolean {
  if (!value) return true;
  const clean = normalizeWhitespace(value);
  return looksGenericWeak(clean);
}

export function isAcceptableGeneratedDescription(
  generated: string,
  existing?: string | null
): { ok: boolean; reason?: string; wordCount: number } {
  const clean = normalizeWhitespace(generated);
  const wc = wordCount(clean);

  if (!clean) return { ok: false, reason: "empty", wordCount: wc };
  if (wc < 80 || wc > 120)
    return { ok: false, reason: "word_count_out_of_range", wordCount: wc };
  if (clean.length < 350)
    return { ok: false, reason: "too_short", wordCount: wc };
  if (looksFilenameLike(clean))
    return { ok: false, reason: "filename_like", wordCount: wc };
  if ((clean.match(/,/g) || []).length > 22)
    return { ok: false, reason: "keyword_stuffing_signal", wordCount: wc };
  if (
    existing &&
    normalizeWhitespace(existing).toLowerCase() === clean.toLowerCase()
  )
    return { ok: false, reason: "same_as_existing", wordCount: wc };
  if (/\n/.test(generated))
    return { ok: false, reason: "not_single_paragraph", wordCount: wc };

  return { ok: true, wordCount: wc };
}
