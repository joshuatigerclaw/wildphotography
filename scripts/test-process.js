/**
 * Local Image Processing Test
 * 
 * Tests the derivative generation without R2 upload
 * 
 * Usage: node scripts/test-process.js <image-path>
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DERIVATIVES = {
  thumb: { width: 400, suffix: 'thumb', quality: 80 },
  small: { width: 900, suffix: 'small', quality: 85 },
  medium: { width: 1600, suffix: 'medium', quality: 90 },
  large: { width: 2400, suffix: 'large', quality: 92 },
  preview: { width: 1200, suffix: 'preview', quality: 85 },
};

async function processLocally(inputPath, photoId) {
  console.log(`[test] Processing: ${inputPath}`);
  
  // Read original
  const originalBuffer = fs.readFileSync(inputPath);
  const metadata = await sharp(originalBuffer).metadata();
  
  console.log(`[test] Original: ${metadata.width}x${metadata.height} (${metadata.format})`);
  
  const baseName = photoId;
  const ext = '.jpg';
  
  const result = {
    original: {
      key: `originals/${baseName}${ext}`,
      width: metadata.width,
      height: metadata.height,
      size: originalBuffer.length,
      format: metadata.format,
    },
    derivatives: {},
    localFiles: [],
  };
  
  // Generate derivatives locally
  for (const [sizeName, config] of Object.entries(DERIVATIVES)) {
    console.log(`[test] Generating ${sizeName}...`);
    
    const aspectRatio = (metadata.height || 1) / (metadata.width || 1);
    let targetWidth = config.width;
    let targetHeight = Math.round(targetWidth * aspectRatio);
    
    // Don't enlarge small images
    if (metadata.width < targetWidth) {
      targetWidth = metadata.width;
      targetHeight = metadata.height;
    }
    
    const derivBuffer = await sharp(originalBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: config.quality, mozjpeg: true })
      .toBuffer();
    
    const derivKey = `derivatives/${config.suffix}/${baseName}${ext}`;
    const localPath = `/tmp/${baseName}-${config.suffix}.jpg`;
    
    // Save locally instead of R2
    fs.writeFileSync(localPath, derivBuffer);
    
    result.derivatives[sizeName] = {
      key: derivKey,
      width: targetWidth,
      height: targetHeight,
      size: derivBuffer.length,
      localPath,
    };
    
    console.log(`[test]   ${sizeName}: ${targetWidth}x${targetHeight} (${derivBuffer.length} bytes) -> ${localPath}`);
  }
  
  return result;
}

// Main
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: node scripts/test-process.js <image-path> [photo-id]');
  process.exit(1);
}

const inputPath = args[0];
const photoId = args[1] || path.basename(inputPath, path.extname(inputPath));

processLocally(inputPath, photoId)
  .then((result) => {
    console.log('\n✅ Processing complete!\n');
    
    console.log('Original:');
    console.log(`  R2 Key: ${result.original.key}`);
    console.log(`  Size: ${result.original.width}x${result.original.height}`);
    
    console.log('\nDerivatives:');
    for (const [size, info] of Object.entries(result.derivatives)) {
      console.log(`  ${size}: ${info.key} (${info.width}x${info.height})`);
    }
    
    console.log('\n--- Neon DB Update ---');
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
    
    console.log('\n--- Public URLs (via media helper) ---');
    const base = 'https://wildphotography-media.josh-ec6.workers.dev';
    console.log(`thumb_url: ${base}/${result.derivatives.thumb.key}`);
    console.log(`small_url: ${base}/${result.derivatives.small.key}`);
    console.log(`medium_url: ${base}/${result.derivatives.medium.key}`);
    console.log(`large_url: ${base}/${result.derivatives.large.key}`);
    console.log(`preview_url: ${base}/${result.derivatives.preview.key}`);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
