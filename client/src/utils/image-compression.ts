import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  quality?: number;
  fileType?: string;
  preserveExif?: boolean;
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  sizeIncreasePercentage: number;
}

/**
 * Pure utility function for image compression
 * Designed to be reusable by both client and server (via migration scripts)
 * Ensures ≤10% size increase guarantee as per requirements
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const originalSize = file.size;
  
  // Default compression options targeting WebP format with 85% quality
  const defaultOptions: CompressionOptions = {
    maxSizeMB: 5, // Allow larger files for high-quality images
    maxWidthOrHeight: 1920, // Max dimension for reasonable file sizes
    useWebWorker: true, // Use web worker for better performance
    quality: 0.85, // 85% quality as specified in requirements
    fileType: 'image/webp', // Target WebP format for better compression
    preserveExif: false, // Remove EXIF data for privacy and smaller size
    ...options
  };

  try {
    // First attempt with default settings
    let compressedFile = await imageCompression(file, {
      maxSizeMB: defaultOptions.maxSizeMB!,
      maxWidthOrHeight: defaultOptions.maxWidthOrHeight!,
      useWebWorker: defaultOptions.useWebWorker!,
      fileType: defaultOptions.fileType!,
      initialQuality: defaultOptions.quality!,
      preserveExif: defaultOptions.preserveExif!,
    });

    let compressedSize = compressedFile.size;
    let sizeIncreasePercentage = ((compressedSize - originalSize) / originalSize) * 100;

    // If compression resulted in >10% size increase, try alternative approaches
    if (sizeIncreasePercentage > 10) {
      console.warn(`Initial compression increased size by ${sizeIncreasePercentage.toFixed(1)}%, trying alternatives...`);
      
      // Try with original format to avoid conversion overhead
      const originalFormatOptions = {
        ...defaultOptions,
        fileType: file.type, // Keep original format
        quality: 0.9, // Higher quality to reduce artifacts
      };

      const alternativeCompressed = await imageCompression(file, {
        maxSizeMB: originalFormatOptions.maxSizeMB!,
        maxWidthOrHeight: originalFormatOptions.maxWidthOrHeight!,
        useWebWorker: originalFormatOptions.useWebWorker!,
        fileType: originalFormatOptions.fileType!,
        initialQuality: originalFormatOptions.quality!,
        preserveExif: originalFormatOptions.preserveExif!,
      });

      const alternativeSize = alternativeCompressed.size;
      const alternativeSizeIncrease = ((alternativeSize - originalSize) / originalSize) * 100;

      // Use the better result
      if (alternativeSizeIncrease < sizeIncreasePercentage) {
        compressedFile = alternativeCompressed;
        compressedSize = alternativeSize;
        sizeIncreasePercentage = alternativeSizeIncrease;
      }

      // If still >10% increase, return original file
      if (sizeIncreasePercentage > 10) {
        console.warn(`Compression still increases size by ${sizeIncreasePercentage.toFixed(1)}%, returning original file`);
        compressedFile = file;
        compressedSize = originalSize;
        sizeIncreasePercentage = 0;
      }
    }

    const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

    return {
      compressedFile,
      originalSize,
      compressedSize,
      compressionRatio,
      sizeIncreasePercentage,
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    
    // Fallback: return original file if compression fails
    return {
      compressedFile: file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
      sizeIncreasePercentage: 0,
    };
  }
}

/**
 * Utility function to check if a file should be compressed
 * Small files or already optimized formats might not benefit from compression
 */
export function shouldCompressImage(file: File): boolean {
  const minSizeForCompression = 100 * 1024; // 100KB
  const alreadyOptimizedFormats = ['image/webp'];
  
  return (
    file.size > minSizeForCompression &&
    !alreadyOptimizedFormats.includes(file.type)
  );
}

/**
 * Utility function to validate image file before compression
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 50 * 1024 * 1024; // 50MB max for processing
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Unsupported file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}`
    };
  }
  
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum allowed: ${maxSize / 1024 / 1024}MB`
    };
  }
  
  return { isValid: true };
}