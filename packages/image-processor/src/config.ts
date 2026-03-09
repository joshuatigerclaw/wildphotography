/**
 * Image Processing Pipeline - Configuration
 * 
 * Centralized configuration for image processing
 */

export const config = {
  // R2 Configuration
  r2: {
    endpoint: process.env.R2_ENDPOINT || 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com',
    region: 'auto',
    bucket: process.env.R2_BUCKET || 'wildphoto-storage',
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  
  // Derivative sizes
  derivatives: {
    thumb: { width: 400, suffix: 'thumb', quality: 80 },
    small: { width: 900, suffix: 'small', quality: 85 },
    medium: { width: 1600, suffix: 'medium', quality: 90 },
    large: { width: 2400, suffix: 'large', quality: 92 },
    preview: { width: 1200, suffix: 'preview', quality: 85 },
  },
  
  // Output format
  format: 'jpeg' as const,
  jpegOptions: {
    quality: 85,
    mozjpeg: true,
  },
};

export default config;
