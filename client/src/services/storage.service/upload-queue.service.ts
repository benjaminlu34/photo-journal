/**
 * Upload Queue Service for managing background photo uploads
 * Implements exponential backoff retry, concurrent upload limiting, and offline queuing
 * Enhanced with comprehensive error handling and recovery mechanisms
 */

import { StorageError, StorageErrorFactory, StorageErrorRecovery } from './storage-errors';

export interface QueuedUpload {
  id: string;
  file: File;
  userId: string;
  journalDate: string;
  noteId: string;
  options?: {
    compress?: boolean;
    quality?: number;
    maxDimension?: number;
  };
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'retrying';
  progress: number;
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  onProgress?: (progress: number) => void;
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
}

export interface UploadQueueStats {
  pending: number;
  uploading: number;
  completed: number;
  failed: number;
  totalSize: number;
}

export class UploadQueueService {
  private static instance: UploadQueueService;
  private queue: Map<string, QueuedUpload> = new Map();
  private activeUploads: Set<string> = new Set();
  private readonly maxConcurrentUploads = 3;
  private readonly baseRetryDelay = 1000; // 1 second
  private readonly maxRetryDelay = 30000; // 30 seconds
  private isProcessing = false;

  static getInstance(): UploadQueueService {
    if (!UploadQueueService.instance) {
      UploadQueueService.instance = new UploadQueueService();
    }
    return UploadQueueService.instance;
  }

  /**
   * Add an upload to the queue
   */
  async enqueue(
    file: File,
    userId: string,
    journalDate: string,
    noteId: string,
    options?: {
      compress?: boolean;
      quality?: number;
      maxDimension?: number;
    },
    callbacks?: {
      onProgress?: (progress: number) => void;
      onComplete?: (result: any) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<string> {
    const uploadId = this.generateUploadId();
    
    const queuedUpload: QueuedUpload = {
      id: uploadId,
      file,
      userId,
      journalDate,
      noteId,
      options,
      status: 'pending',
      progress: 0,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      onProgress: callbacks?.onProgress,
      onComplete: callbacks?.onComplete,
      onError: callbacks?.onError,
    };

    this.queue.set(uploadId, queuedUpload);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return uploadId;
  }

  /**
   * Get upload status by ID
   */
  getUpload(uploadId: string): QueuedUpload | undefined {
    return this.queue.get(uploadId);
  }

  /**
   * Cancel an upload
   */
  cancel(uploadId: string): boolean {
    const upload = this.queue.get(uploadId);
    if (!upload) return false;

    if (upload.status === 'uploading') {
      // Can't cancel active uploads, but mark for removal after completion
      upload.status = 'failed';
      upload.error = 'Cancelled by user';
    } else {
      this.queue.delete(uploadId);
    }

    return true;
  }

  /**
   * Retry a failed upload
   */
  retry(uploadId: string): boolean {
    const upload = this.queue.get(uploadId);
    if (!upload || upload.status !== 'failed') return false;

    upload.status = 'pending';
    upload.retryCount = 0;
    upload.error = undefined;
    upload.updatedAt = new Date();

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return true;
  }

  /**
   * Get queue statistics
   */
  getStats(): UploadQueueStats {
    const stats: UploadQueueStats = {
      pending: 0,
      uploading: 0,
      completed: 0,
      failed: 0,
      totalSize: 0,
    };

    for (const upload of this.queue.values()) {
      stats.totalSize += upload.file.size;
      
      switch (upload.status) {
        case 'pending':
        case 'retrying':
          stats.pending++;
          break;
        case 'uploading':
          stats.uploading++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }
    }

    return stats;
  }

  /**
   * Clear completed and failed uploads
   */
  cleanup(): void {
    for (const [id, upload] of this.queue.entries()) {
      if (upload.status === 'completed' || upload.status === 'failed') {
        this.queue.delete(id);
      }
    }
  }

  /**
   * Clear all uploads
   */
  clear(): void {
    this.queue.clear();
    this.activeUploads.clear();
  }

  /**
   * Process the upload queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;

    try {
      while (this.hasWork()) {
        // Find pending uploads that can be started
        const pendingUploads = Array.from(this.queue.values())
          .filter(upload => 
            (upload.status === 'pending' || upload.status === 'retrying') &&
            !this.activeUploads.has(upload.id)
          )
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        // Start uploads up to the concurrent limit
        const availableSlots = this.maxConcurrentUploads - this.activeUploads.size;
        const uploadsToStart = pendingUploads.slice(0, availableSlots);

        if (uploadsToStart.length === 0) {
          // Wait for active uploads to complete
          await this.waitForActiveUploads();
          continue;
        }

        // Start the uploads
        const uploadPromises = uploadsToStart.map(upload => this.processUpload(upload));
        
        // Wait for at least one to complete before continuing
        await Promise.race(uploadPromises);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single upload with comprehensive error handling and retry logic
   */
  private async processUpload(upload: QueuedUpload): Promise<void> {
    this.activeUploads.add(upload.id);
    upload.status = 'uploading';
    upload.progress = 0;
    upload.updatedAt = new Date();

    try {
      // Check if device is online before attempting upload
      if (!navigator.onLine) {
        throw StorageErrorFactory.createNetworkError(new Error('Device is offline'), true);
      }

      // Import PhotoStorageService dynamically to avoid circular dependencies
      const { PhotoStorageService } = await import('./photo-storage.service');
      const photoService = PhotoStorageService.getInstance();

      // Check storage health before upload
      const storageHealth = photoService.getStorageHealth();
      if (!storageHealth.isAvailable) {
        throw storageHealth.error || StorageErrorFactory.createServiceUnavailableError('storage');
      }

      // Simulate progress updates during upload
      const progressInterval = setInterval(() => {
        if (upload.progress < 90) {
          upload.progress += Math.random() * 10;
          upload.onProgress?.(upload.progress);
        }
      }, 200);

      try {
        const result = await photoService.uploadPhoto(
          upload.userId,
          upload.journalDate,
          upload.file,
          upload.noteId,
          upload.options
        );

        clearInterval(progressInterval);
        
        upload.status = 'completed';
        upload.progress = 100;
        upload.updatedAt = new Date();
        
        upload.onProgress?.(100);
        upload.onComplete?.(result);
        
        console.log(`Upload completed: ${upload.id}`);
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    } catch (error) {
      console.error(`Upload failed: ${upload.id}`, error);
      
      // Convert to StorageError if not already
      const storageError = error instanceof StorageError 
        ? error 
        : StorageErrorFactory.createFromError(error instanceof Error ? error : new Error('Upload failed'));
      
      upload.retryCount++;
      upload.error = storageError.getUserMessage();
      upload.updatedAt = new Date();

      // Determine if we should retry based on error type and retry count
      const shouldRetry = StorageErrorRecovery.shouldRetry(storageError, upload.retryCount, upload.maxRetries);
      
      if (shouldRetry) {
        // Schedule retry with exponential backoff
        upload.status = 'retrying';
        const delay = StorageErrorRecovery.calculateRetryDelay(upload.retryCount, this.baseRetryDelay, this.maxRetryDelay);
        
        console.log(`Scheduling retry for upload ${upload.id} in ${delay}ms (attempt ${upload.retryCount + 1}/${upload.maxRetries})`);
        
        // For offline errors, wait for device to come online
        if (storageError.type === 'OFFLINE_ERROR') {
          StorageErrorRecovery.waitForOnline().then(() => {
            setTimeout(() => {
              if (this.queue.has(upload.id)) {
                upload.status = 'pending';
                // Restart processing if needed
                if (!this.isProcessing) {
                  this.processQueue();
                }
              }
            }, delay);
          });
        } else {
          setTimeout(() => {
            if (this.queue.has(upload.id)) {
              upload.status = 'pending';
              // Restart processing if needed
              if (!this.isProcessing) {
                this.processQueue();
              }
            }
          }, delay);
        }
      } else {
        // Max retries exceeded or non-retryable error
        upload.status = 'failed';
        upload.onError?.(storageError);
        
        console.error(`Upload permanently failed: ${upload.id}`, {
          error: storageError.getUserMessage(),
          retryCount: upload.retryCount,
          maxRetries: upload.maxRetries,
          retryable: storageError.isRetryable(),
        });
      }
    } finally {
      this.activeUploads.delete(upload.id);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = Math.min(
      this.baseRetryDelay * Math.pow(2, retryCount - 1),
      this.maxRetryDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  /**
   * Check if there's work to be done
   */
  private hasWork(): boolean {
    return Array.from(this.queue.values()).some(upload => 
      upload.status === 'pending' || 
      upload.status === 'retrying' || 
      upload.status === 'uploading'
    );
  }

  /**
   * Wait for active uploads to complete
   */
  private async waitForActiveUploads(): Promise<void> {
    if (this.activeUploads.size === 0) return;

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.activeUploads.size < this.maxConcurrentUploads) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Generate unique upload ID
   */
  private generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}