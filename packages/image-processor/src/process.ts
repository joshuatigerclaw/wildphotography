/**
 * Image Processing Pipeline
 * 
 * Generates derivatives from an original image and uploads to R2
 * 
 * Sizes:
 * - thumb: 400px
 * - small: 900px  
 * - medium: 1600px
 * - large: 2400px
 */

import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';

const R2_CONFIG = {
  endpoint: 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com',
  region: 'auto',
  bucket: 'wildphoto-storage',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || 'YOUR_ACCESS_KEY',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'YOUR_SECRET',
};

// Derivative sizes configuration
const DERIVATIVES = {
  thumb: { width: 400, suffix: '-thumb', quality: 80 },
  small: { width: 900, suffix: '-small', quality: 85 },
  medium: { width: 1600, suffix: '-medium', quality: 90 },
  large: { width: 2400, suffix: '-large', quality: 92 },
};

interface ProcessedImage {
  original: {
    key: string;
    size: number;
  };
  derivatives: {
    [key: string]: {
      key: string;
      size: number;
      width: number;
      height: number;
    };
  };
}

/**
 * Process an image and generate all derivatives
 */
export async function processImage(
  inputPath: string,
  originalKey: string
): Promise<ProcessedImage> {
  console.log(`Processing: ${inputPath}`);
  
  // Read original image
  const originalBuffer = fs.readFileSync(inputPath);
  const originalMeta = await sharp(originalBuffer).metadata();
  
  console.log(`Original: ${originalMeta.width}x${originalMeta.height}`);
  
  // Upload original to R2
  const originalKeyFull = `originals/${originalKey}`;
  await uploadToR2(originalBuffer, originalKeyFull, originalBuffer.length);
  
  console.log(`Uploaded original: ${originalKeyFull}`);
  
  const result: ProcessedImage = {
    original: {
      key: originalKeyFull,
      size: originalBuffer.length,
    },
    derivatives: {},
  };
  
  // Generate each derivative size
  for (const [sizeName, config] of Object.entries(DERIVATIVES)) {
    console.log(`Generating ${sizeName}...`);
    
    // Calculate height maintaining aspect ratio
    const aspectRatio = (originalMeta.height || 1) / (originalMeta.width || 1);
    const targetWidth = config.width;
    const targetHeight = Math.round(targetWidth * aspectRatio);
    
    // Generate derivative
    const derivativeBuffer = await sharp(originalBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: config.quality })
      .toBuffer();
    
    const derivativeKey = `derivatives/${sizeName}${config.suffix === '-thumb' ? 's' : ''}/${originalKey.replace('.jpg', '.jpg').replace('.jpeg', '.jpg').replace('.png', '.jpg')}`;
    
    // Upload to R2
    await uploadToR2(derivativeBuffer, derivativeKey, derivativeBuffer.length);
    
    result.derivatives[sizeName] = {
      key: derivativeKey,
      size: derivativeBuffer.length,
      width: targetWidth,
      height: targetHeight,
    };
    
    console.log(`Uploaded ${sizeName}: ${derivativeKey} (${targetWidth}x${targetHeight})`);
  }
  
  return result;
}

/**
 * Upload buffer to R2 using S3 API
 */
async function uploadToR2(
  buffer: Buffer,
  key: string,
  size: number
): Promise<void> {
  const client = new S3Client({
    endpoint: R2_CONFIG.endpoint,
    region: R2_CONFIG.region,
    credentials: {
      accessKeyId: R2_CONFIG.accessKeyId,
      secretAccessKey: R2_CONFIG.secretAccessKey,
    },
  });

  const command = new PutObjectCommand({
    Bucket: R2_CONFIG.bucket,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
    ContentLength: size,
  });

  await client.send(command);
}

/**
 * Process image from URL (downloads first)
 */
export async function processImageFromUrl(
  imageUrl: string,
  originalKey: string
): Promise<ProcessedImage> {
  // Download image
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Save to temp file
  const tempPath = `/tmp/${originalKey}`;
  fs.writeFileSync(tempPath, buffer);
  
  try {
    return await processImage(tempPath, originalKey);
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: npx ts-node src/process.ts <image-path> [original-key]');
    console.log('Or: npx ts-node src/process.ts --url <image-url> [original-key]');
    process.exit(1);
  }
  
  async function main() {
    const isUrl = args[0] === '--url';
    const input = isUrl ? args[1] : args[0];
    const originalKey = args[2] || path.basename(input, path.extname(input)) + '.jpg';
    
    console.log('Starting image processing pipeline...');
    console.log(`Input: ${input}`);
    console.log(`Output key: ${originalKey}`);
    
    let result: ProcessedImage;
    
    if (isUrl) {
      result = await processImageFromUrl(input, originalKey);
    } else {
      result = await processImage(input, originalKey);
    }
    
    console.log('\n✅ Processing complete!');
    console.log('\nDerivative keys:');
    console.log(`  Original: ${result.original.key}`);
    for (const [size, info] of Object.entries(result.derivatives)) {
      console.log(`  ${size}: ${info.key} (${info.width}x${info.height})`);
    }
    
    console.log('\nR2 keys ready for Typesense update:');
    console.log(JSON.stringify(result, null, 2));
  }
  
  main().catch(console.error);
}
