/**
 * Comprehensive error handling for photo storage operations
 * Provides specific error types, recovery strategies, and user-friendly messages
 */

export enum StorageErrorType {
  // Upload errors
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  CORRUPTED_FILE = 'CORRUPTED_FILE',
  
  // Storage quota errors
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  STORAGE_FULL = 'STORAGE_FULL',
  
  // Network and connectivity errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  OFFLINE_ERROR = 'OFFLINE_ERROR',
  
  // Authentication and permission errors
  AUTH_ERROR = 'AUTH_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Signed URL errors
  SIGNED_URL_FAILED = 'SIGNED_URL_FAILED',
  SIGNED_URL_EXPIRED = 'SIGNED_URL_EXPIRED',
  
  // Cache errors
  CACHE_ERROR = 'CACHE_ERROR',
  CACHE_FULL = 'CACHE_FULL',
  
  // Service availability errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  STORAGE_SERVICE_DOWN = 'STORAGE_SERVICE_DOWN',
  
  // Compression errors
  COMPRESSION_FAILED = 'COMPRESSION_FAILED',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface StorageErrorDetails {
  type: StorageErrorType;
  message: string;
  userMessage: string;
  recoverable: boolean;
  retryable: boolean;
  suggestedActions: string[];
  originalError?: Error;
  metadata?: Record<string, any>;
}

export class StorageError extends Error {
  public readonly type: StorageErrorType;
  public readonly userMessage: string;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;
  public readonly suggestedActions: string[];
  public readonly originalError?: Error;
  public readonly metadata?: Record<string, any>;

  constructor(details: StorageErrorDetails) {
    super(details.message);
    this.name = 'StorageError';
    this.type = details.type;
    this.userMessage = details.userMessage;
    this.recoverable = details.recoverable;
    this.retryable = details.retryable;
    this.suggestedActions = details.suggestedActions;
    this.originalError = details.originalError;
    this.metadata = details.metadata;
  }

  /**
   * Create a StorageError from a generic error
   */
  static fromError(error: Error, context?: string): StorageError {
    return StorageErrorFactory.createFromError(error, context);
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.retryable;
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return this.recoverable;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.userMessage;
  }

  /**
   * Get suggested recovery actions
   */
  getSuggestedActions(): string[] {
    return this.suggestedActions;
  }
}

export class StorageErrorFactory {
  /**
   * Create error for file validation failures
   */
  static createFileValidationError(
    file: File,
    reason: 'size' | 'type' | 'corrupted',
    maxSize?: number
  ): StorageError {
    switch (reason) {
      case 'size':
        return new StorageError({
          type: StorageErrorType.FILE_TOO_LARGE,
          message: `File size ${file.size} bytes exceeds maximum allowed size`,
          userMessage: `File is too large (${this.formatFileSize(file.size)}). Maximum allowed size is ${maxSize ? this.formatFileSize(maxSize) : '10MB'}.`,
          recoverable: true,
          retryable: false,
          suggestedActions: [
            'Choose a smaller image file',
            'Compress the image before uploading',
            'Use a different image format (WebP, JPEG)',
          ],
          metadata: { fileSize: file.size, maxSize, fileName: file.name },
        });

      case 'type':
        return new StorageError({
          type: StorageErrorType.INVALID_FILE_TYPE,
          message: `Invalid file type: ${file.type}`,
          userMessage: `File type "${file.type}" is not supported. Please use JPEG, PNG, WebP, or GIF images.`,
          recoverable: true,
          retryable: false,
          suggestedActions: [
            'Convert the image to a supported format (JPEG, PNG, WebP, GIF)',
            'Choose a different image file',
          ],
          metadata: { fileType: file.type, fileName: file.name },
        });

      case 'corrupted':
        return new StorageError({
          type: StorageErrorType.CORRUPTED_FILE,
          message: `File appears to be corrupted: ${file.name}`,
          userMessage: 'The selected image file appears to be corrupted or damaged.',
          recoverable: true,
          retryable: false,
          suggestedActions: [
            'Try opening the image in another application to verify it works',
            'Choose a different image file',
            'Re-save the image from its original source',
          ],
          metadata: { fileName: file.name, fileSize: file.size },
        });

      default:
        return this.createUnknownError(new Error(`Unknown file validation error: ${reason}`));
    }
  }

  /**
   * Create error for storage quota issues
   */
  static createQuotaError(
    quotaType: 'storage' | 'cache',
    currentUsage?: number,
    maxQuota?: number
  ): StorageError {
    const isStorage = quotaType === 'storage';
    
    return new StorageError({
      type: isStorage ? StorageErrorType.QUOTA_EXCEEDED : StorageErrorType.CACHE_FULL,
      message: `${quotaType} quota exceeded`,
      userMessage: isStorage 
        ? 'Your storage quota has been exceeded. Please free up space or upgrade your plan.'
        : 'Local cache is full. Some images may load slower until cache is cleaned.',
      recoverable: true,
      retryable: false,
      suggestedActions: isStorage ? [
        'Delete some old images to free up space',
        'Upgrade to a plan with more storage',
        'Compress images before uploading',
      ] : [
        'Clear browser cache',
        'Close other tabs to free up memory',
        'The app will automatically clean old cached images',
      ],
      metadata: { quotaType, currentUsage, maxQuota },
    });
  }

  /**
   * Create error for network issues
   */
  static createNetworkError(originalError: Error, isOffline = false): StorageError {
    if (isOffline) {
      return new StorageError({
        type: StorageErrorType.OFFLINE_ERROR,
        message: 'Device is offline',
        userMessage: 'You are currently offline. Images will be uploaded when connection is restored.',
        recoverable: true,
        retryable: true,
        suggestedActions: [
          'Check your internet connection',
          'Images will be queued and uploaded automatically when online',
          'You can continue working offline',
        ],
        originalError,
      });
    }

    const isTimeout = originalError.message.toLowerCase().includes('timeout');
    
    return new StorageError({
      type: isTimeout ? StorageErrorType.TIMEOUT_ERROR : StorageErrorType.NETWORK_ERROR,
      message: `Network error: ${originalError.message}`,
      userMessage: isTimeout 
        ? 'Upload timed out. This may be due to a slow connection or large file size.'
        : 'Network connection failed. Please check your internet connection.',
      recoverable: true,
      retryable: true,
      suggestedActions: [
        'Check your internet connection',
        'Try again in a few moments',
        isTimeout ? 'Consider compressing the image for faster upload' : 'Switch to a more stable network if possible',
      ],
      originalError,
    });
  }

  /**
   * Create error for authentication issues
   */
  static createAuthError(reason: 'expired' | 'missing' | 'invalid'): StorageError {
    switch (reason) {
      case 'expired':
        return new StorageError({
          type: StorageErrorType.SESSION_EXPIRED,
          message: 'Authentication session has expired',
          userMessage: 'Your session has expired. Please sign in again.',
          recoverable: true,
          retryable: false,
          suggestedActions: [
            'Sign in again',
            'Refresh the page',
          ],
        });

      case 'missing':
        return new StorageError({
          type: StorageErrorType.AUTH_ERROR,
          message: 'No authentication session found',
          userMessage: 'You need to be signed in to upload images.',
          recoverable: true,
          retryable: false,
          suggestedActions: [
            'Sign in to your account',
            'Refresh the page',
          ],
        });

      case 'invalid':
        return new StorageError({
          type: StorageErrorType.PERMISSION_DENIED,
          message: 'Invalid authentication credentials',
          userMessage: 'Access denied. Please check your permissions.',
          recoverable: true,
          retryable: false,
          suggestedActions: [
            'Sign out and sign in again',
            'Contact support if the problem persists',
          ],
        });

      default:
        return this.createUnknownError(new Error(`Unknown auth error: ${reason}`));
    }
  }

  /**
   * Create error for signed URL issues
   */
  static createSignedUrlError(originalError: Error): StorageError {
    const isExpired = originalError.message.toLowerCase().includes('expired');
    
    return new StorageError({
      type: isExpired ? StorageErrorType.SIGNED_URL_EXPIRED : StorageErrorType.SIGNED_URL_FAILED,
      message: `Signed URL error: ${originalError.message}`,
      userMessage: isExpired 
        ? 'Image link has expired. Refreshing...'
        : 'Failed to generate secure image link.',
      recoverable: true,
      retryable: true,
      suggestedActions: [
        'The app will automatically refresh the image link',
        'Refresh the page if the problem persists',
      ],
      originalError,
    });
  }

  /**
   * Create error for service availability issues
   */
  static createServiceUnavailableError(service: 'storage' | 'cache' | 'compression'): StorageError {
    return new StorageError({
      type: StorageErrorType.SERVICE_UNAVAILABLE,
      message: `${service} service is unavailable`,
      userMessage: `The ${service} service is temporarily unavailable. Please try again later.`,
      recoverable: true,
      retryable: true,
      suggestedActions: [
        'Try again in a few minutes',
        service === 'storage' ? 'Images will be saved locally until service is restored' : 'Some features may be limited',
        'Check service status page for updates',
      ],
      metadata: { service },
    });
  }

  /**
   * Create error for compression failures
   */
  static createCompressionError(originalError: Error, fallbackUsed = false): StorageError {
    return new StorageError({
      type: StorageErrorType.COMPRESSION_FAILED,
      message: `Image compression failed: ${originalError.message}`,
      userMessage: fallbackUsed 
        ? 'Image compression failed, but upload will continue with original file.'
        : 'Failed to compress image. Upload may be slower.',
      recoverable: true,
      retryable: false,
      suggestedActions: fallbackUsed ? [
        'Upload will continue with original file',
        'Consider manually compressing the image',
      ] : [
        'Try uploading the original image',
        'Use a different image format',
        'Manually compress the image before uploading',
      ],
      originalError,
      metadata: { fallbackUsed },
    });
  }

  /**
   * Create error from generic Error object
   */
  static createFromError(error: Error, context?: string): StorageError {
    const message = error.message.toLowerCase();
    
    // Network-related errors
    if (message.includes('network') || message.includes('fetch')) {
      return this.createNetworkError(error);
    }
    
    // Authentication errors
    if (message.includes('unauthorized') || message.includes('auth')) {
      return this.createAuthError('invalid');
    }
    
    // Quota errors
    if (message.includes('quota') || message.includes('storage full')) {
      return this.createQuotaError('storage');
    }
    
    // Timeout errors
    if (message.includes('timeout')) {
      return this.createNetworkError(error);
    }
    
    // Service unavailable
    if (message.includes('service unavailable') || message.includes('502') || message.includes('503')) {
      return this.createServiceUnavailableError('storage');
    }
    
    // Default to unknown error
    return this.createUnknownError(error, context);
  }

  /**
   * Create unknown error with fallback handling
   */
  static createUnknownError(originalError: Error, context?: string): StorageError {
    return new StorageError({
      type: StorageErrorType.UNKNOWN_ERROR,
      message: `Unknown error${context ? ` in ${context}` : ''}: ${originalError.message}`,
      userMessage: 'An unexpected error occurred. Please try again.',
      recoverable: true,
      retryable: true,
      suggestedActions: [
        'Try the operation again',
        'Refresh the page',
        'Contact support if the problem persists',
      ],
      originalError,
      metadata: { context },
    });
  }

  /**
   * Format file size for user display
   */
  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * Error recovery utilities
 */
export class StorageErrorRecovery {
  /**
   * Determine if an error should trigger a retry
   */
  static shouldRetry(error: StorageError, retryCount: number, maxRetries = 3): boolean {
    if (retryCount >= maxRetries) return false;
    if (!error.isRetryable()) return false;
    
    // Don't retry certain error types
    const nonRetryableTypes = [
      StorageErrorType.FILE_TOO_LARGE,
      StorageErrorType.INVALID_FILE_TYPE,
      StorageErrorType.CORRUPTED_FILE,
      StorageErrorType.PERMISSION_DENIED,
    ];
    
    return !nonRetryableTypes.includes(error.type);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  static calculateRetryDelay(retryCount: number, baseDelay = 1000, maxDelay = 30000): number {
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  /**
   * Get recovery suggestions based on error type
   */
  static getRecoveryActions(error: StorageError): string[] {
    return error.getSuggestedActions();
  }

  /**
   * Check if device is online
   */
  static isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Wait for device to come online
   */
  static waitForOnline(): Promise<void> {
    if (navigator.onLine) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const handleOnline = () => {
        window.removeEventListener('online', handleOnline);
        resolve();
      };
      
      window.addEventListener('online', handleOnline);
    });
  }
}