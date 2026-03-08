#!/usr/bin/env node
/**
 * Cloudflare R2 Storage Configuration
 * 
 * Bucket: wildphotography-media
 * Public URL: https://pub-wildphotography-media.existing.blog
 * 
 * Path Structure:
 * - originals/           # Private - original high-res images
 * - derivatives/thumbs/  # Public - thumbnail sized
 * - derivatives/small/  # Public - small web size
 * - derivatives/medium/ # Public - medium web size
 * - derivatives/large/  # Public - large web size
 * - derivatives/preview/ # Public - preview sized
 * - downloads/          # Public - downloadable versions
 */

const R2_CONFIG = {
  bucketName: 'wildphotography-media',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  publicUrl: process.env.R2_PUBLIC_URL || 'https://wildphotography-media.example.com',
};

// Path builders
export const paths = {
  originals: (filename: string) => `originals/${filename}`,
  thumb: (filename: string) => `derivatives/thumbs/${filename}`,
  small: (filename: string) => `derivatives/small/${filename}`,
  medium: (filename: string) => `derivatives/medium/${filename}`,
  large: (filename: string) => `derivatives/large/${filename}`,
  preview: (filename: string) => `derivatives/preview/${filename}`,
  download: (filename: string) => `downloads/${filename}`,
};

// URL builder - returns public URL for a given path
export function getPublicUrl(path: string): string {
  return `${R2_CONFIG.publicUrl}/${path}`;
}

// Check if URL is a derivative (publicly accessible)
export function isDerivative(path: string): boolean {
  return path.startsWith('derivatives/') || path.startsWith('downloads/');
}

// Check if URL is an original (private)
export function isOriginal(path: string): boolean {
  return path.startsWith('originals/');
}

export default R2_CONFIG;
