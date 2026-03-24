/**
 * Title utilities for photo display
 * Converts raw filenames to human-readable titles
 */

// Common camera/import noise tokens to remove
const NOISE_TOKENS = [
  'img', 'dsc', 'dji', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2',
  'edited', 'final', 'copy', 'export', 'print', 'web', 'full', 'high',
  'resized', 'cropped', 'adjusted', 'processed', 'original', 'img_',
  'dsc_', 'mg_', 'pgn', 'dsc', 'img', 'frame', 'photo', 'image',
  'goprog', 'lumix', 'sony', 'canon', 'nikon', 'fuji', 'panasonic',
  'r6', 'r5', 'r7', 'a7', 'z6', 'xt4', 'xt5', 'xt30', 'xt3',
  '90d', '80d', '850d', 'eos', 'alpha', 'coolpix', 'powershot'
];

/**
 * Clean a filename into a human-readable title
 */
export function cleanTitle(filename: string): string {
  if (!filename) return '';
  
  // Remove extension
  let title = filename.replace(/\.(jpg|jpeg|png|gif|webp|tif|tiff|raw|heic)$/i, '');
  
  // Replace hyphens and underscores with spaces
  title = title.replace(/[-_]/g, ' ');
  
  // Remove common camera noise tokens when they're standalone
  const words = title.split(/\s+/);
  const cleanedWords = words.filter(word => {
    const lower = word.toLowerCase().replace(/\d+$/, ''); // Remove trailing numbers
    return !NOISE_TOKENS.includes(lower);
  });
  
  title = cleanedWords.join(' ');
  
  // Collapse multiple spaces
  title = title.replace(/\s+/g, ' ').trim();
  
  // Convert to title case
  title = title.replace(/\b\w/g, c => c.toUpperCase());
  
  // If still looks like a machine filename (mostly numeric or short codes)
  if (/^\d+$/.test(title) || (title.length < 5 && /^[a-z]+\d+$/i.test(title))) {
    return '';
  }
  
  return title;
}

/**
 * Get the best display title for a photo
 * Priority: explicit title > cleaned filename
 */
export function getDisplayTitle(title: string | null | undefined, filename?: string): string {
  // If explicit title exists and doesn't look like a raw filename
  if (title && title.length > 0) {
    // Check if it's a good title (not just digits)
    if (!/^\d+$/.test(title) && title.length >= 3) {
      return title;
    }
  }
  
  // Try to clean the filename
  if (filename) {
    const cleaned = cleanTitle(filename);
    if (cleaned && cleaned.length >= 3) {
      return cleaned;
    }
  }
  
  // No good title available
  return '';
}

/**
 * Check if a title looks like a raw filename
 */
export function looksLikeFilename(title: string | null | undefined): boolean {
  if (!title) return true;
  
  // Check for common filename patterns
  const patterns = [
    /^(img|dsc|dji|cr2|mg_|dsc_)\d+/i,
    /^[a-z]+\d{3,5}\.(jpg|raw)/i,
    /^[a-z]{2,4}\d{3,6}$/i,
    /^\d{3,6}$/, // Just numbers
  ];
  
  return patterns.some(p => p.test(title));
}
