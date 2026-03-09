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
 * - preview: 1200px
 */

import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';
import { config } from './config';

export interface DerivativeResult {
  key: string;
  size: number;
  width: number;
  height: number;
}

export interface ProcessedImage {
  original: {
    key: string;
    size: number;
    width: number;
    height: number;
    format: string;
  };
  derivatives: {
    [key: string]: DerivativeResult;
  };
}

/**
 * Upload buffer to R2 using S3 API
 */
async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string = 'image/jpeg'
): Promise<void> {
  if (!config.r2.accessKeyId || !config.r2.secretAccessKey) {
    throw new Error('R2 credentials not configured');
  }
  
  const client = new S3Client({
    endpoint: config.r2.endpoint,
    region: config.r2.region,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });

  const command = new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ContentLength: buffer.length,
  });

  await client.send(command);
}

/**
 * Generate a derivative from buffer
 */
async function generateDerivative(
  buffer: Buffer,
  sizeName: string
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const derivativeConfig = config.derivatives[sizeName as keyof typeof config.derivatives];
  
  if (!derivativeConfig) {
    throw new Error(`Unknown derivative size: ${sizeName}`);
  }
  
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width || 1;
  const originalHeight = metadata.height || 1;
  const aspectRatio = originalHeight / originalWidth;
  
  let targetWidth = derivativeConfig.width;
  let targetHeight = Math.round(targetWidth * aspectRatio);
  
  // Don't enlarge small images
  if (originalWidth < targetWidth) {
    targetWidth = originalWidth;
    targetHeight = originalHeight;
  }
  
  const derivativeBuffer = await sharp(buffer)
    .resize(targetWidth, targetHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: derivativeConfig.quality, mozjpeg: true })
    .toBuffer();
  
  return {
    buffer: derivativeBuffer,
    width: targetWidth,
    height: targetHeight,
  };
}

/**
 * Process an image and generate all derivatives
 * 
 * @param inputPath - Local file path to the original image
 * @param photoId - Unique identifier for the photo (used for R2 keys)
 * @param originalFilename - Original filename
 * @returns ProcessedImage result with all R2 keys
 */
export async function processImage(
  inputPath: string,
  photoId: string,
  originalFilename?: string
): Promise<ProcessedImage> {
  console.log(`[image-processor] Processing: ${inputPath}`);
  
  // Read original image
  const originalBuffer = fs.readFileSync(inputPath);
  const originalMeta = await sharp(originalBuffer).metadata();
  
  const width = originalMeta.width || 0;
  const height = originalMeta.height || 0;
  const format = originalMeta.format || 'jpeg';
  
  console.log(`[image-processor] Original: ${width}x${height} (${format})`);
  
  // Generate filename from photoId
  const baseName = photoId;
  const ext = '.jpg'; // All derivatives as JPEG
  
  // Upload original to R2 (private)
  const originalKey = `originals/${baseName}${ext}`;
  await uploadToR2(originalBuffer, originalKey, `image/${format}`);
  
  console.log(`[image-processor] Uploaded original: ${originalKey}`);
  
  const result: ProcessedImage = {
    original: {
      key: originalKey,
      size: originalBuffer.length,
      width,
      height,
      format,
    },
    derivatives: {},
  };
  
  // Generate each derivative size
  const derivativeSizes = Object.keys(config.derivatives) as Array<keyof typeof config.derivatives>;
  
  for (const sizeName of derivativeSizes) {
    console.log(`[image-processor] Generating ${sizeName}...`);
    
    try {
      const { buffer, width: derivWidth, height: derivHeight } = await generateDerivative(
        originalBuffer,
        sizeName
      );
      
      const derivConfig = config.derivatives[sizeName];
      const derivKey = `derivatives/${derivConfig.suffix}/${baseName}${ext}`;
      
      await uploadToR2(buffer, derivKey);
      
      result.derivatives[sizeName] = {
        key: derivKey,
        size: buffer.length,
        width: derivWidth,
        height: derivHeight,
      };
      
      console.log(`[image-processor] Uploaded ${sizeName}: ${derivKey} (${derivWidth}x${derivHeight})`);
    } catch (error) {
      console.error(`[image-processor] Failed to generate ${sizeName}:`, error);
      throw error;
    }
  }
  
  return result;
}

/**
 * Process image from URL (downloads first)
 */
export async function processImageFromUrl(
  imageUrl: string,
  photoId: string
): Promise<ProcessedImage> {
  console.log(`[image-processor] Downloading from: ${imageUrl}`);
  
  // Download image
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Save to temp file
  const tempPath = `/tmp/${photoId}-${Date.now()}.jpg`;
  fs.writeFileSync(tempPath, buffer);
  
  try {
    return await processImage(tempPath, photoId);
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

/**
 * Get metadata from image buffer without saving
 */
export async function getImageMetadata(buffer: Buffer): Promise<sharp.Metadata> {
  return sharp(buffer).metadata();
}

/**
 * Generate a single derivative size from buffer
 */
export async function generateSingleDerivative(
  buffer: Buffer,
  sizeName: string
): Promise<{ buffer: Buffer; width: number; height: number }> {
  return generateDerivative(buffer, sizeName);
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: npx ts-node src/process.ts <image-path> <photo-id>');
    console.log('Or: npx ts-node src/process.ts --url <image-url> <photo-id>');
    console.log('');
    console.log('Environment variables:');
    console.log('  R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
    process.exit(1);
  }
  
  async function main() {
    const isUrl = args[0] === '--url';
    const input = isUrl ? args[1] : args[0];
    const photoId = args[2] || path.basename(input, path.extname(input));
    
    console.log('=== Image Processing Pipeline ===');
    console.log(`Input: ${input}`);
    console.log(`Photo ID: ${photoId}`);
    console.log('');
    
    let result: ProcessedImage;
    
    if (isUrl) {
      result = await processImageFromUrl(input, photoId);
    } else {
      result = await processImage(input, photoId);
    }
    
    console.log('\n✅ Processing complete!\n');
    
    console.log('Results:');
    console.log(`  Original: ${result.original.key} (${result.original.width}x${result.original.height})`);
    console.log('');
    console.log('Derivatives:');
    for (const [size, info] of Object.entries(result.derivatives)) {
      console.log(`  ${size}: ${info.key} (${info.width}x${info.height})`);
    }
    
    console.log('\n--- For Neon DB update ---');
    console.log(JSON.stringify({
      original_r2_key: result.original.key,
      thumb_r2_key: result.derivatives.thumb?.key,
      small_r2_key: result.derivatives.small?.key,
      medium_r2_key: result.derivatives.medium?.key,
      large_r2_key: result.derivatives.large?.key,
      preview_r2_key: result.derivatives.preview?.key,
      width: result.original.width,
      height: result.original.height,
      orientation: result.original.width > result.original.height ? 'landscape' : 
                  result.original.width < result.original.height ? 'portrait' : 'square',
    }, null, 2));
  }
  
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
