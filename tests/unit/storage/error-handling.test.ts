/**
 * Test suite for comprehensive error handling in photo storage services
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageError, StorageErrorFactory, StorageErrorType, StorageErrorRecovery } from '@/services/storage.service/storage-errors';

describe('Storage Error Handling', () => {
  describe('StorageErrorFactory', () => {
    it('should create file validation errors correctly', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      const sizeError = StorageErrorFactory.createFileValidationError(file, 'size', 1024);
      expect(sizeError.type).toBe(StorageErrorType.FILE_TOO_LARGE);
      expect(sizeError.isRetryable()).toBe(false);
      expect(sizeError.isRecoverable()).toBe(true);
      expect(sizeError.getUserMessage()).toContain('too large');

      const typeError = StorageErrorFactory.createFileValidationError(file, 'type');
      expect(typeError.type).toBe(StorageErrorType.INVALID_FILE_TYPE);
      expect(typeError.getUserMessage()).toContain('not supported');

      const corruptedError = StorageErrorFactory.createFileValidationError(file, 'corrupted');
      expect(corruptedError.type).toBe(StorageErrorType.CORRUPTED_FILE);
      expect(corruptedError.getUserMessage()).toContain('corrupted');
    });

    it('should create network errors correctly', () => {
      const networkError = new Error('Network request failed');
      const storageError = StorageErrorFactory.createNetworkError(networkError);
      
      expect(storageError.type).toBe(StorageErrorType.NETWORK_ERROR);
      expect(storageError.isRetryable()).toBe(true);
      expect(storageError.getUserMessage()).toContain('connection failed');

      const offlineError = StorageErrorFactory.createNetworkError(networkError, true);
      expect(offlineError.type).toBe(StorageErrorType.OFFLINE_ERROR);
      expect(offlineError.getUserMessage()).toContain('offline');
    });

    it('should create quota errors correctly', () => {
      const storageQuotaError = StorageErrorFactory.createQuotaError('storage', 1000, 500);
      expect(storageQuotaError.type).toBe(StorageErrorType.QUOTA_EXCEEDED);
      expect(storageQuotaError.getUserMessage()).toContain('quota');

      const cacheQuotaError = StorageErrorFactory.createQuotaError('cache');
      expect(cacheQuotaError.type).toBe(StorageErrorType.CACHE_FULL);
      expect(cacheQuotaError.getUserMessage()).toContain('cache');
    });

    it('should create auth errors correctly', () => {
      const expiredError = StorageErrorFactory.createAuthError('expired');
      expect(expiredError.type).toBe(StorageErrorType.SESSION_EXPIRED);
      expect(expiredError.getUserMessage()).toContain('expired');

      const missingError = StorageErrorFactory.createAuthError('missing');
      expect(missingError.type).toBe(StorageErrorType.AUTH_ERROR);
      expect(missingError.getUserMessage()).toContain('signed in');

      const invalidError = StorageErrorFactory.createAuthError('invalid');
      expect(invalidError.type).toBe(StorageErrorType.PERMISSION_DENIED);
      expect(invalidError.getUserMessage()).toContain('denied');
    });

    it('should create service unavailable errors correctly', () => {
      const serviceError = StorageErrorFactory.createServiceUnavailableError('storage');
      expect(serviceError.type).toBe(StorageErrorType.SERVICE_UNAVAILABLE);
      expect(serviceError.getUserMessage()).toContain('unavailable');
      expect(serviceError.isRetryable()).toBe(true);
    });

    it('should create compression errors correctly', () => {
      const compressionError = new Error('Compression failed');
      const storageError = StorageErrorFactory.createCompressionError(compressionError, true);
      
      expect(storageError.type).toBe(StorageErrorType.COMPRESSION_FAILED);
      expect(storageError.getUserMessage()).toContain('compression failed');
      expect(storageError.metadata?.fallbackUsed).toBe(true);
    });

    it('should create errors from generic errors', () => {
      const networkError = new Error('fetch failed');
      const storageError = StorageErrorFactory.createFromError(networkError);
      expect(storageError.type).toBe(StorageErrorType.NETWORK_ERROR);

      const authError = new Error('unauthorized access');
      const authStorageError = StorageErrorFactory.createFromError(authError);
      expect(authStorageError.type).toBe(StorageErrorType.PERMISSION_DENIED);

      const quotaError = new Error('quota exceeded');
      const quotaStorageError = StorageErrorFactory.createFromError(quotaError);
      expect(quotaStorageError.type).toBe(StorageErrorType.QUOTA_EXCEEDED);

      const unknownError = new Error('something weird happened');
      const unknownStorageError = StorageErrorFactory.createFromError(unknownError);
      expect(unknownStorageError.type).toBe(StorageErrorType.UNKNOWN_ERROR);
    });
  });

  describe('StorageErrorRecovery', () => {
    it('should determine retry eligibility correctly', () => {
      const retryableError = new StorageError({
        type: StorageErrorType.NETWORK_ERROR,
        message: 'Network failed',
        userMessage: 'Network failed',
        recoverable: true,
        retryable: true,
        suggestedActions: [],
      });

      const nonRetryableError = new StorageError({
        type: StorageErrorType.FILE_TOO_LARGE,
        message: 'File too large',
        userMessage: 'File too large',
        recoverable: true,
        retryable: false,
        suggestedActions: [],
      });

      expect(StorageErrorRecovery.shouldRetry(retryableError, 1, 3)).toBe(true);
      expect(StorageErrorRecovery.shouldRetry(retryableError, 3, 3)).toBe(false);
      expect(StorageErrorRecovery.shouldRetry(nonRetryableError, 1, 3)).toBe(false);
    });

    it('should calculate retry delays correctly', () => {
      const delay1 = StorageErrorRecovery.calculateRetryDelay(1);
      const delay2 = StorageErrorRecovery.calculateRetryDelay(2);
      const delay3 = StorageErrorRecovery.calculateRetryDelay(3);

      expect(delay1).toBeGreaterThan(1000);
      expect(delay1).toBeLessThan(2200); // With jitter (exponential backoff)
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should respect maximum delay', () => {
      const delay = StorageErrorRecovery.calculateRetryDelay(10, 1000, 5000);
      expect(delay).toBeLessThanOrEqual(5500); // Max delay + jitter
    });

    it('should detect online status', () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      expect(StorageErrorRecovery.isOnline()).toBe(true);

      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      expect(StorageErrorRecovery.isOnline()).toBe(false);
    });
  });

  describe('StorageError', () => {
    it('should create error with all properties', () => {
      const error = new StorageError({
        type: StorageErrorType.UPLOAD_FAILED,
        message: 'Upload failed',
        userMessage: 'Your upload failed',
        recoverable: true,
        retryable: true,
        suggestedActions: ['Try again', 'Check connection'],
        originalError: new Error('Original error'),
        metadata: { context: 'test' },
      });

      expect(error.type).toBe(StorageErrorType.UPLOAD_FAILED);
      expect(error.message).toBe('Upload failed');
      expect(error.getUserMessage()).toBe('Your upload failed');
      expect(error.isRecoverable()).toBe(true);
      expect(error.isRetryable()).toBe(true);
      expect(error.getSuggestedActions()).toEqual(['Try again', 'Check connection']);
      expect(error.originalError).toBeInstanceOf(Error);
      expect(error.metadata?.context).toBe('test');
    });

    it('should create error from generic error', () => {
      const genericError = new Error('Generic error');
      const storageError = StorageError.fromError(genericError, 'test context');
      
      expect(storageError).toBeInstanceOf(StorageError);
      expect(storageError.originalError).toBe(genericError);
    });
  });
});