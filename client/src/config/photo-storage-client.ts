/**
 * Client-side Storage Configuration
 * 
 * This module provides client-specific storage configuration for the photo note persistence system.
 */

import { getStorageConfig, validateStorageConfig, type StorageConfig } from '../../../shared/config/photo-storage-config';

/**
 * Client-specific storage configuration
 */
interface ClientStorageConfig extends StorageConfig {
  /** Supabase project URL */
  supabaseUrl: string;

  /** Supabase anonymous key for client operations */
  anonKey: string;

  /** Enable client-side compression */
  enableClientCompression: boolean;

  /** Maximum files that can be selected at once */
  maxFilesPerUpload: number;

  /** Show upload progress indicators */
  showUploadProgress: boolean;

  /** Cache signed URLs in IndexedDB */
  enableUrlCaching: boolean;

  /** URL cache TTL in milliseconds */
  urlCacheTtlMs: number;
}

/**
 * Get client storage configuration
 */
export function getClientStorageConfig(): ClientStorageConfig {
  const baseConfig = getStorageConfig();

  const clientConfig: ClientStorageConfig = {
    ...baseConfig,

    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',

    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',

    enableClientCompression: import.meta.env.VITE_ENABLE_CLIENT_COMPRESSION?.toLowerCase() !== 'false',

    maxFilesPerUpload: import.meta.env.VITE_MAX_FILES_PER_UPLOAD
      ? parseInt(import.meta.env.VITE_MAX_FILES_PER_UPLOAD, 10)
      : 10,

    showUploadProgress: import.meta.env.VITE_SHOW_UPLOAD_PROGRESS?.toLowerCase() !== 'false',

    enableUrlCaching: import.meta.env.VITE_ENABLE_URL_CACHING?.toLowerCase() !== 'false',

    urlCacheTtlMs: import.meta.env.VITE_URL_CACHE_TTL_MS
      ? parseInt(import.meta.env.VITE_URL_CACHE_TTL_MS, 10)
      : 24 * 60 * 60 * 1000 // 24 hours
  };

  // Validate configuration
  const validation = validateStorageConfig(baseConfig);
  const clientValidation = validateClientConfig(clientConfig);

  if (!validation.isValid || !clientValidation.isValid) {
    const allErrors = [...validation.errors, ...clientValidation.errors];
    console.error('Invalid client storage configuration:', allErrors);

    // In development, throw error. In production, log and continue with defaults
    if (import.meta.env.DEV) {
      throw new Error(`Invalid storage configuration: ${allErrors.join(', ')}`);
    }
  }

  return clientConfig;
}

/**
 * Validate client-specific configuration
 */
function validateClientConfig(config: ClientStorageConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.supabaseUrl) {
    errors.push('VITE_SUPABASE_URL is required');
  }

  if (!config.anonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY is required');
  }

  if (config.maxFilesPerUpload <= 0 || config.maxFilesPerUpload > 50) {
    errors.push('Max files per upload must be between 1 and 50');
  }

  if (config.urlCacheTtlMs <= 0) {
    errors.push('URL cache TTL must be positive');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get file input accept attribute for supported image types
 */
export function getFileInputAccept(config?: ClientStorageConfig): string {
  const storageConfig = config || getClientStorageConfig();
  return storageConfig.supportedMimeTypes.join(',');
}

/**
 * Check if file is valid for upload
 */
export function validateFileForUpload(
  file: File,
  config?: ClientStorageConfig
): { isValid: boolean; error?: string } {
  const storageConfig = config || getClientStorageConfig();

  // Check file size
  const maxSizeBytes = storageConfig.maxImageSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${storageConfig.maxImageSizeMB}MB)`
    };
  }

  // Check MIME type
  if (!storageConfig.supportedMimeTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type "${file.type}" is not supported. Supported types: ${storageConfig.supportedMimeTypes.join(', ')}`
    };
  }

  return { isValid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get compression settings for client-side compression
 */
export function getCompressionSettings(config?: ClientStorageConfig) {
  const storageConfig = config || getClientStorageConfig();

  return {
    maxSizeMB: storageConfig.maxImageSizeMB,
    maxWidthOrHeight: storageConfig.maxImageDimension,
    useWebWorker: true,
    quality: storageConfig.compressionQuality,
    fileType: storageConfig.defaultCompressionFormat === 'webp' ? 'image/webp' : 'image/jpeg',
    initialQuality: storageConfig.compressionQuality,
    alwaysKeepResolution: false
  };
}

/**
 * Log client storage configuration (development only)
 */
export function logClientStorageConfig(): void {
  if (!import.meta.env.DEV) return;

  try {
    const config = getClientStorageConfig();

    console.log('📱 Client Storage Configuration:');
    console.log(`   Bucket: ${config.bucketName}`);
    console.log(`   Max File Size: ${config.maxImageSizeMB}MB`);
    console.log(`   Max Files Per Upload: ${config.maxFilesPerUpload}`);
    console.log(`   Client Compression: ${config.enableClientCompression ? 'enabled' : 'disabled'}`);
    console.log(`   Upload Progress: ${config.showUploadProgress ? 'enabled' : 'disabled'}`);
    console.log(`   URL Caching: ${config.enableUrlCaching ? 'enabled' : 'disabled'}`);
    console.log(`   Cache TTL: ${Math.round(config.urlCacheTtlMs / 1000 / 60)} minutes`);
    console.log(`   Supabase URL: ${config.supabaseUrl ? '✅ configured' : '❌ missing'}`);
    console.log(`   Anon Key: ${config.anonKey ? '✅ configured' : '❌ missing'}`);

  } catch (error) {
    console.error('❌ Client storage configuration error:', error instanceof Error ? error.message : String(error));
  }
}

// Initialize configuration
let _config: ClientStorageConfig | null = null;

export function initializeClientStorageConfig(): ClientStorageConfig {
  if (!_config) {
    _config = getClientStorageConfig();

    if (import.meta.env.DEV) {
      logClientStorageConfig();
    }
  }

  return _config;
}

// Export for use in other modules
export { type ClientStorageConfig };