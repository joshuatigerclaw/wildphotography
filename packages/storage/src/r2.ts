/**
 * Cloudflare R2 Storage Path Configuration
 * 
 * Bucket: wildphoto-storage
 * 
 * Path Structure:
 * - originals/              (PRIVATE)
 * - derivatives/thumbs/    (PUBLIC)
 * - derivatives/small/      (PUBLIC)
 * - derivatives/medium/    (PUBLIC)
 * - derivatives/large/     (PUBLIC)
 * - downloads/             (PUBLIC)
 */

const R2_CONFIG = {
  bucketName: 'wildphoto-storage',
  publicUrl: 'https://pub-wildphoto-storage.existing.blog', // R2.dev public URL
  // Alternative: custom domain (requires DNS setup)
  // publicUrl: 'https://media.wildphotography.com',
};

function buildUrls(filename) {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  
  return {
    thumb_url: `${R2_CONFIG.publicUrl}/derivatives/thumbs/${baseName}-thumb.jpg`,
    small_url: `${R2_CONFIG.publicUrl}/derivatives/small/${baseName}-small.jpg`,
    medium_url: `${R2_CONFIG.publicUrl}/derivatives/medium/${baseName}-medium.jpg`,
    large_url: `${R2_CONFIG.publicUrl}/derivatives/large/${baseName}-large.jpg`,
    original_url: `${R2_CONFIG.publicUrl}/originals/${filename}`,
  };
}

// Only expose derivative URLs
function getPublicUrls(filename) {
  const urls = buildUrls(filename);
  // Remove original_url - it's private
  delete urls.original_url;
  return urls;
}

module.exports = { 
  R2_CONFIG, 
  buildUrls, 
  getPublicUrls,
  isDerivative: (path) => path.startsWith('derivatives/') || path.startsWith('downloads/'),
  isOriginal: (path) => path.startsWith('originals/'),
};
