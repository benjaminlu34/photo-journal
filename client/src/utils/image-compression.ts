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
 * Enhanced with comprehensive error handling and recovery strategies
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const originalSize = file.size;
  
  // Validate input file
  if (!file || !(file instanceof File)) {
    throw new Error('Invalid file provided for compression');
  }

  if (originalSize === 0) {
    throw new Error('Cannot compress empty file');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error(`Cannot compress non-image file: ${file.type}`);
  }

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

  // Validate compression options
  if (defaultOptions.quality && (defaultOptions.quality < 0 || defaultOptions.quality > 1)) {
    throw new Error('Quality must be between 0 and 1');
  }

  if (defaultOptions.maxWidthOrHeight && defaultOptions.maxWidthOrHeight < 1) {
    throw new Error('Max dimension must be positive');
  }

  try {
    // First attempt with default settings
    let compressedFile = await attemptCompression(file, {
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
      
      // Strategy 1: Try with original format to avoid conversion overhead
      try {
        const originalFormatOptions = {
          ...defaultOptions,
          fileType: file.type, // Keep original format
          quality: 0.9, // Higher quality to reduce artifacts
        };

        const alternativeCompressed = await attemptCompression(file, {
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
      } catch (alternativeError) {
        console.warn('Alternative compression strategy failed:', alternativeError);
        // Continue with original compressed result
      }

      // Strategy 2: If still >10% increase, try JPEG as last resort
      if (sizeIncreasePercentage > 10 && file.type !== 'image/jpeg') {
        try {
          const jpegCompressed = await attemptCompression(file, {
            maxSizeMB: defaultOptions.maxSizeMB!,
            maxWidthOrHeight: defaultOptions.maxWidthOrHeight!,
            useWebWorker: false, // Disable web worker for JPEG fallback
            fileType: 'image/jpeg',
            initialQuality: 0.8,
            preserveExif: false,
          });

          const jpegSize = jpegCompressed.size;
          const jpegSizeIncrease = ((jpegSize - originalSize) / originalSize) * 100;

          if (jpegSizeIncrease < sizeIncreasePercentage) {
            compressedFile = jpegCompressed;
            compressedSize = jpegSize;
            sizeIncreasePercentage = jpegSizeIncrease;
          }
        } catch (jpegError) {
          console.warn('JPEG fallback compression failed:', jpegError);
          // Continue with best result so far
        }
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

    // Validate result
    if (!compressedFile || compressedFile.size === 0) {
      throw new Error('Compression produced invalid result');
    }

    return {
      compressedFile,
      originalSize,
      compressedSize,
      compressionRatio,
      sizeIncreasePercentage,
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    
    // Enhanced error handling - provide more specific error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown compression error';
    
    // Check for specific error types
    if (errorMessage.includes('memory') || errorMessage.includes('out of memory')) {
      throw new Error('Compression failed due to insufficient memory. Try a smaller image or close other browser tabs.');
    }
    
    if (errorMessage.includes('timeout')) {
      throw new Error('Compression timed out. The image may be too large or complex.');
    }
    
    if (errorMessage.includes('format') || errorMessage.includes('decode')) {
      throw new Error('Image format is not supported or file is corrupted.');
    }
    
    // Fallback: return original file if compression fails
    console.warn('Falling back to original file due to compression failure');
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
 * Attempt compression with timeout and error handling
 */
async function attemptCompression(file: File, options: any): Promise<File> {
  const timeoutMs = 30000; // 30 second timeout
  
  return Promise.race([
    imageCompression(file, options),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Compression timeout')), timeoutMs)
    ),
  ]);
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