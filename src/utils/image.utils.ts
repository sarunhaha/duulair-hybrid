/**
 * Image Utilities
 * Compress and resize images for API upload
 */

import sharp from 'sharp';

// Max file size for OpenRouter/Claude Vision API (5MB)
const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB to be safe
const MAX_DIMENSION = 2048; // Max width/height

export interface CompressedImage {
  buffer: Buffer;
  base64: string;
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}

/**
 * Compress image to fit within API limits
 * @param imageBuffer - Original image buffer
 * @param mimeType - Original MIME type
 * @returns Compressed image data
 */
export async function compressImageForAPI(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<CompressedImage> {
  const originalSize = imageBuffer.length;

  console.log(`🖼️ Image compression - original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

  // If already small enough, return as-is
  if (originalSize <= MAX_FILE_SIZE) {
    console.log(`✅ Image size OK, no compression needed`);
    return {
      buffer: imageBuffer,
      base64: imageBuffer.toString('base64'),
      mimeType,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false
    };
  }

  // Need to compress - wrap in try-catch for sharp errors
  try {
    console.log(`🔄 Compressing image with sharp...`);

    let quality = 80;
    let compressedBuffer: Buffer;

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const { width = 0, height = 0 } = metadata;
    console.log(`📐 Original dimensions: ${width}x${height}`);

    // Calculate resize dimensions if too large
    let resizeWidth = width;
    let resizeHeight = height;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width > height) {
        resizeWidth = MAX_DIMENSION;
        resizeHeight = Math.round((height / width) * MAX_DIMENSION);
      } else {
        resizeHeight = MAX_DIMENSION;
        resizeWidth = Math.round((width / height) * MAX_DIMENSION);
      }
      console.log(`📐 Resizing to ${resizeWidth}x${resizeHeight}`);
    }

    // Compress with decreasing quality until under limit
    while (quality >= 20) {
      compressedBuffer = await sharp(imageBuffer)
        .resize(resizeWidth, resizeHeight, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer();

      if (compressedBuffer.length <= MAX_FILE_SIZE) {
        console.log(`✅ Compressed to ${(compressedBuffer.length / 1024 / 1024).toFixed(2)} MB (quality: ${quality})`);
        return {
          buffer: compressedBuffer,
          base64: compressedBuffer.toString('base64'),
          mimeType: 'image/jpeg',
          originalSize,
          compressedSize: compressedBuffer.length,
          wasCompressed: true
        };
      }

      quality -= 10;
      console.log(`🔄 Still too large (${(compressedBuffer.length / 1024 / 1024).toFixed(2)} MB), trying quality ${quality}...`);
    }

    // Last resort: aggressive resize
    console.log(`⚠️ Aggressive resize needed`);
    compressedBuffer = await sharp(imageBuffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 60 })
      .toBuffer();

    console.log(`✅ Final size: ${(compressedBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    return {
      buffer: compressedBuffer,
      base64: compressedBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      originalSize,
      compressedSize: compressedBuffer.length,
      wasCompressed: true
    };

  } catch (sharpError: any) {
    console.error(`❌ Sharp compression failed:`, sharpError.message);

    // Fallback: If image is too big, throw error; otherwise return original
    if (originalSize > MAX_FILE_SIZE) {
      throw new Error(`Image too large (${(originalSize / 1024 / 1024).toFixed(2)} MB) and compression failed: ${sharpError.message}`);
    }

    // Return original if small enough
    console.log(`⚠️ Returning original image (compression failed but size OK)`);
    return {
      buffer: imageBuffer,
      base64: imageBuffer.toString('base64'),
      mimeType,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false
    };
  }
}

export default { compressImageForAPI };
