/**
 * Server-side Storage Configuration
 * 
 * This module provides server-specific storage configuration with validation.
 */

import { getStorageConfig, validateStorageConfig, type StorageConfig } from '../../shared/config/photo-storage-config';

/**
 * Server-specific storage configuration
 */
interface ServerStorageConfig extends StorageConfig {
  /** Supabase service role key for admin operations */
  serviceRoleKey: string;
  
  /** Supabase project URL */
  supabaseUrl: string;
  
  /** Enable detailed logging for storage operations */
  enableStorageLogging: boolean;
  
  /** Maximum concurrent uploads per user */
  maxConcurrentUploads: number;
  
  /** Upload timeout in milliseconds */
  uploadTimeoutMs: number;
}

/**
 * Get server storage configuration with validation
 */
export function getServerStorageConfig(): ServerStorageConfig {
  const baseConfig = getStorageConfig();
  
  const serverConfig: ServerStorageConfig = {
    ...baseConfig,
    
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    
    enableStorageLogging: process.env.ENABLE_STORAGE_LOGGING?.toLowerCase() === 'true' || false,
    
    maxConcurrentUploads: process.env.MAX_CONCURRENT_UPLOADS
      ? parseInt(process.env.MAX_CONCURRENT_UPLOADS, 10)
      : 5,
    
    uploadTimeoutMs: process.env.UPLOAD_TIMEOUT_MS
      ? parseInt(process.env.UPLOAD_TIMEOUT_MS, 10)
      : 30000 // 30 seconds
  };
  
  // Validate configuration
  const validation = validateStorageConfig(baseConfig);
  const serverValidation = validateServerConfig(serverConfig);
  
  if (!validation.isValid || !serverValidation.isValid) {
    const allErrors = [...validation.errors, ...serverValidation.errors];
    throw new Error(`Invalid storage configuration: ${allErrors.join(', ')}`);
  }
  
  return serverConfig;
}

/**
 * Validate server-specific configuration
 */
function validateServerConfig(config: ServerStorageConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.serviceRoleKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  
  if (!config.supabaseUrl) {
    errors.push('SUPABASE_URL or VITE_SUPABASE_URL is required');
  }
  
  if (config.maxConcurrentUploads <= 0 || config.maxConcurrentUploads > 20) {
    errors.push('Max concurrent uploads must be between 1 and 20');
  }
  
  if (config.uploadTimeoutMs <= 0 || config.uploadTimeoutMs > 300000) {
    errors.push('Upload timeout must be between 1ms and 5 minutes');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Log storage configuration (without sensitive data)
 */
// export function logStorageConfig(): void {
//   try {
//     const config = getServerStorageConfig();
    
//     console.log('📁 Storage Configuration:');
//     console.log(`   Bucket: ${config.bucketName}`);
//     console.log(`   Signed URL TTL: ${config.signedUrlTtlSeconds}s (${Math.round(config.signedUrlTtlSeconds / 86400)} days)`);
//     console.log(`   Compression Quality: ${config.compressionQuality}`);
//     console.log(`   Max File Size: ${config.maxImageSizeMB}MB`);
//     console.log(`   Max Dimension: ${config.maxImageDimension}px`);
//     console.log(`   Default Format: ${config.defaultCompressionFormat}`);
//     console.log(`   Supported Types: ${config.supportedMimeTypes.join(', ')}`);
//     console.log(`   Max Concurrent Uploads: ${config.maxConcurrentUploads}`);
//     console.log(`   Upload Timeout: ${config.uploadTimeoutMs}ms`);
//     console.log(`   Storage Logging: ${config.enableStorageLogging ? 'enabled' : 'disabled'}`);
//     console.log(`   Supabase URL: ${config.supabaseUrl ? '✅ configured' : '❌ missing'}`);
//     console.log(`   Service Role Key: ${config.serviceRoleKey ? '✅ configured' : '❌ missing'}`);
    
//   } catch (error) {
//     console.error('❌ Storage configuration error:', error instanceof Error ? error.message : String(error));
//   }
// }

// Initialize and validate configuration on module load
let _config: ServerStorageConfig | null = null;

export function initializeStorageConfig(): ServerStorageConfig {
  if (!_config) {
    _config = getServerStorageConfig();
    
    // if (process.env.NODE_ENV !== 'test') {
    //   logStorageConfig();
    // }
  }
  
  return _config;
}

// Export for use in other modules
export { type ServerStorageConfig };