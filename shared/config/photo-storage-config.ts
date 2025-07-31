/**
 * Storage Configuration with Default Values
 * 
 * This module provides centralized configuration for photo storage with sensible defaults.
 * Environment variables are optional - the system will use these defaults if not provided.
 */

export interface StorageConfig {
  /** Supabase Storage bucket name for journal images */
  bucketName: string;
  
  /** Signed URL time-to-live in seconds (default: 7 days) */
  signedUrlTtlSeconds: number;
  
  /** Image compression quality (0.1-1.0, default: 0.85) */
  compressionQuality: number;
  
  /** Maximum image file size in MB (default: 50MB) */
  maxImageSizeMB: number;
  
  /** Maximum image dimension in pixels (default: 1920px) */
  maxImageDimension: number;
  
  /** Supported image MIME types */
  supportedMimeTypes: string[];
  
  /** Default compression format for uploads */
  defaultCompressionFormat: 'webp' | 'jpeg';
  
  /** Enable progressive JPEG for better loading experience */
  enableProgressiveJpeg: boolean;
}

/**
 * Default storage configuration values
 */
const DEFAULT_CONFIG: StorageConfig = {
  bucketName: 'journal-images',
  signedUrlTtlSeconds: 7 * 24 * 60 * 60, // 7 days
  compressionQuality: 0.85,
  maxImageSizeMB: 50,
  maxImageDimension: 1920,
  supportedMimeTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
  ],
  defaultCompressionFormat: 'webp',
  enableProgressiveJpeg: true
};

/**
 * Get storage configuration with environment variable overrides
 */
export function getStorageConfig(): StorageConfig {
  return {
    bucketName: process.env.JOURNAL_IMAGES_BUCKET || DEFAULT_CONFIG.bucketName,
    
    signedUrlTtlSeconds: process.env.SIGNED_URL_TTL_SECONDS 
      ? parseInt(process.env.SIGNED_URL_TTL_SECONDS, 10)
      : DEFAULT_CONFIG.signedUrlTtlSeconds,
    
    compressionQuality: process.env.IMAGE_COMPRESSION_QUALITY
      ? parseFloat(process.env.IMAGE_COMPRESSION_QUALITY)
      : DEFAULT_CONFIG.compressionQuality,
    
    maxImageSizeMB: process.env.MAX_IMAGE_SIZE_MB
      ? parseInt(process.env.MAX_IMAGE_SIZE_MB, 10)
      : DEFAULT_CONFIG.maxImageSizeMB,
    
    maxImageDimension: process.env.MAX_IMAGE_DIMENSION
      ? parseInt(process.env.MAX_IMAGE_DIMENSION, 10)
      : DEFAULT_CONFIG.maxImageDimension,
    
    supportedMimeTypes: process.env.SUPPORTED_IMAGE_TYPES
      ? process.env.SUPPORTED_IMAGE_TYPES.split(',').map(type => type.trim())
      : DEFAULT_CONFIG.supportedMimeTypes,
    
    defaultCompressionFormat: (process.env.DEFAULT_COMPRESSION_FORMAT as 'webp' | 'jpeg')
      || DEFAULT_CONFIG.defaultCompressionFormat,
    
    enableProgressiveJpeg: process.env.ENABLE_PROGRESSIVE_JPEG
      ? process.env.ENABLE_PROGRESSIVE_JPEG.toLowerCase() === 'true'
      : DEFAULT_CONFIG.enableProgressiveJpeg
  };
}

/**
 * Validate storage configuration values
 */
export function validateStorageConfig(config: StorageConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate bucket name
  if (!config.bucketName || config.bucketName.trim().length === 0) {
    errors.push('Bucket name cannot be empty');
  }

  // Validate TTL
  if (config.signedUrlTtlSeconds <= 0) {
    errors.push('Signed URL TTL must be positive');
  }

  // Validate compression quality
  if (config.compressionQuality < 0.1 || config.compressionQuality > 1.0) {
    errors.push('Compression quality must be between 0.1 and 1.0');
  }

  // Validate max file size
  if (config.maxImageSizeMB <= 0 || config.maxImageSizeMB > 100) {
    errors.push('Max image size must be between 1MB and 100MB');
  }

  // Validate max dimension
  if (config.maxImageDimension <= 0 || config.maxImageDimension > 4096) {
    errors.push('Max image dimension must be between 1px and 4096px');
  }

  // Validate MIME types
  if (!config.supportedMimeTypes || config.supportedMimeTypes.length === 0) {
    errors.push('At least one supported MIME type must be specified');
  }

  // Validate compression format
  if (!['webp', 'jpeg'].includes(config.defaultCompressionFormat)) {
    errors.push('Default compression format must be "webp" or "jpeg"');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get file size limit in bytes
 */
export function getMaxFileSizeBytes(config?: StorageConfig): number {
  const storageConfig = config || getStorageConfig();
  return storageConfig.maxImageSizeMB * 1024 * 1024;
}

/**
 * Check if a MIME type is supported
 */
export function isSupportedMimeType(mimeType: string, config?: StorageConfig): boolean {
  const storageConfig = config || getStorageConfig();
  return storageConfig.supportedMimeTypes.includes(mimeType.toLowerCase());
}

/**
 * Get file extension for compression format
 */
export function getCompressionExtension(format: 'webp' | 'jpeg'): string {
  return format === 'webp' ? '.webp' : '.jpg';
}

/**
 * Generate storage path for an image
 */
export function generateStoragePath(
  userId: string, 
  date: string, 
  noteId: string, 
  filename: string,
  compressionFormat?: 'webp' | 'jpeg'
): string {
  const config = getStorageConfig();
  const format = compressionFormat || config.defaultCompressionFormat;
  const extension = getCompressionExtension(format);
  
  // Remove original extension and add compression extension
  const baseFilename = filename.replace(/\.[^/.]+$/, '');
  const compressedFilename = `compressed-${baseFilename}${extension}`;
  
  return `${userId}/${date}/${noteId}/${compressedFilename}`;
}

/**
 * Parse storage path to extract components
 */
export function parseStoragePath(path: string): {
  userId: string;
  date: string;
  noteId: string;
  filename: string;
} | null {
  const parts = path.split('/');
  
  if (parts.length < 4) {
    return null;
  }
  
  return {
    userId: parts[0],
    date: parts[1],
    noteId: parts[2],
    filename: parts.slice(3).join('/') // Handle filenames with slashes
  };
}

// Export default configuration for reference
export { DEFAULT_CONFIG };