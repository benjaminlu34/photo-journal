/**
 * Service Availability Manager
 * Coordinates between storage and cache services to provide graceful degradation
 * Implements fallback strategies when services are unavailable
 */

import { StorageHealthService, StorageHealthStatus } from './storage-health.service';
import { PhotoCacheService } from './photo-cache.service';
import { StorageError, StorageErrorFactory, StorageErrorType } from './storage-errors';

export interface ServiceAvailability {
  storage: {
    available: boolean;
    degraded: boolean;
    capabilities: {
      upload: boolean;
      download: boolean;
      signedUrls: boolean;
      delete: boolean;
    };
    error?: StorageError;
  };
  cache: {
    available: boolean;
    error?: Error;
  };
  offline: boolean;
  recommendedStrategy: AvailabilityStrategy;
}

export interface AvailabilityStrategy {
  mode: 'normal' | 'degraded' | 'offline' | 'cache-only';
  allowUploads: boolean;
  useCache: boolean;
  showOfflineMessage: boolean;
  showDegradedMessage: boolean;
  retryInterval: number;
  fallbackActions: string[];
}

export class ServiceAvailabilityManager {
  private static instance: ServiceAvailabilityManager;
  private storageHealth = StorageHealthService.getInstance();
  private cacheService = PhotoCacheService.getInstance();
  private listeners: ((availability: ServiceAvailability) => void)[] = [];
  private currentAvailability: ServiceAvailability;

  static getInstance(): ServiceAvailabilityManager {
    if (!ServiceAvailabilityManager.instance) {
      ServiceAvailabilityManager.instance = new ServiceAvailabilityManager();
    }
    return ServiceAvailabilityManager.instance;
  }

  constructor() {
    this.currentAvailability = this.assessAvailability();
    this.setupListeners();
  }

  /**
   * Get current service availability status
   */
  getAvailability(): ServiceAvailability {
    return { ...this.currentAvailability };
  }

  /**
   * Subscribe to availability changes
   */
  subscribe(listener: (availability: ServiceAvailability) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Force a refresh of availability status
   */
  async refresh(): Promise<ServiceAvailability> {
    await this.storageHealth.checkHealth();
    this.updateAvailability();
    return this.getAvailability();
  }

  /**
   * Get recommended fallback strategy for current conditions
   */
  getRecommendedStrategy(): AvailabilityStrategy {
    return this.currentAvailability.recommendedStrategy;
  }

  /**
   * Check if uploads should be allowed
   */
  shouldAllowUploads(): boolean {
    return this.currentAvailability.recommendedStrategy.allowUploads;
  }

  /**
   * Check if cache should be used
   */
  shouldUseCache(): boolean {
    return this.currentAvailability.recommendedStrategy.useCache;
  }

  /**
   * Get user-friendly status message
   */
  getStatusMessage(): {
    type: 'normal' | 'warning' | 'error' | 'info';
    message: string;
    actions?: string[];
  } {
    const strategy = this.currentAvailability.recommendedStrategy;
    
    switch (strategy.mode) {
      case 'normal':
        return {
          type: 'normal',
          message: 'All services are working normally.',
        };

      case 'degraded':
        return {
          type: 'warning',
          message: 'Some features may be limited due to service issues.',
          actions: strategy.fallbackActions,
        };

      case 'offline':
        return {
          type: 'error',
          message: 'You are currently offline. Images will sync when connection is restored.',
          actions: [
            'Check your internet connection',
            'You can continue working with cached images',
            'New uploads will be queued until online',
          ],
        };

      case 'cache-only':
        return {
          type: 'warning',
          message: 'Storage service is unavailable. Using cached images only.',
          actions: [
            'Some images may not be available',
            'New uploads are temporarily disabled',
            'Service will resume automatically when available',
          ],
        };

      default:
        return {
          type: 'info',
          message: 'Checking service status...',
        };
    }
  }

  /**
   * Attempt to recover services
   */
  async attemptRecovery(): Promise<{
    storage: boolean;
    cache: boolean;
    overall: boolean;
  }> {
    console.log('Attempting service recovery...');
    
    const results = {
      storage: false,
      cache: false,
      overall: false,
    };

    // Try to recover storage
    try {
      const healthStatus = await this.storageHealth.checkHealth();
      results.storage = healthStatus.isAvailable;
    } catch (error) {
      console.error('Storage recovery failed:', error);
    }

    // Try to recover cache
    try {
      results.cache = await this.cacheService.attemptRecovery();
    } catch (error) {
      console.error('Cache recovery failed:', error);
    }

    // Update availability after recovery attempts
    this.updateAvailability();
    
    results.overall = this.currentAvailability.storage.available || this.currentAvailability.cache.available;
    
    console.log('Service recovery results:', results);
    return results;
  }

  /**
   * Setup listeners for service changes
   */
  private setupListeners(): void {
    // Listen to storage health changes
    this.storageHealth.subscribe(() => {
      this.updateAvailability();
    });

    // Listen to online/offline events
    window.addEventListener('online', () => {
      console.log('Device came online');
      this.updateAvailability();
    });

    window.addEventListener('offline', () => {
      console.log('Device went offline');
      this.updateAvailability();
    });
  }

  /**
   * Assess current service availability
   */
  private assessAvailability(): ServiceAvailability {
    const storageStatus = this.storageHealth.getHealthStatus();
    const cacheHealth = this.cacheService.getHealthStatus();
    const isOffline = !navigator.onLine;

    const availability: ServiceAvailability = {
      storage: {
        available: storageStatus.isAvailable && !isOffline,
        degraded: storageStatus.degradedMode,
        capabilities: storageStatus.capabilities,
        error: storageStatus.error,
      },
      cache: {
        available: cacheHealth.available,
        error: cacheHealth.error,
      },
      offline: isOffline,
      recommendedStrategy: this.determineStrategy(storageStatus, cacheHealth, isOffline),
    };

    return availability;
  }

  /**
   * Determine the best strategy based on service availability
   */
  private determineStrategy(
    storageStatus: StorageHealthStatus,
    cacheHealth: { available: boolean; error?: Error },
    isOffline: boolean
  ): AvailabilityStrategy {
    // Offline mode
    if (isOffline) {
      return {
        mode: 'offline',
        allowUploads: false,
        useCache: true,
        showOfflineMessage: true,
        showDegradedMessage: false,
        retryInterval: 5000,
        fallbackActions: [
          'Check your internet connection',
          'Images will sync when connection is restored',
          'You can view cached images while offline',
        ],
      };
    }

    // Storage completely unavailable
    if (!storageStatus.isAvailable) {
      if (cacheHealth.available) {
        return {
          mode: 'cache-only',
          allowUploads: false,
          useCache: true,
          showOfflineMessage: false,
          showDegradedMessage: true,
          retryInterval: 30000,
          fallbackActions: [
            'Storage service is temporarily unavailable',
            'You can view cached images',
            'New uploads will be available when service resumes',
          ],
        };
      } else {
        return {
          mode: 'degraded',
          allowUploads: false,
          useCache: false,
          showOfflineMessage: false,
          showDegradedMessage: true,
          retryInterval: 30000,
          fallbackActions: [
            'Both storage and cache are unavailable',
            'Please refresh the page',
            'Contact support if the problem persists',
          ],
        };
      }
    }

    // Storage available but degraded
    if (storageStatus.degradedMode) {
      return {
        mode: 'degraded',
        allowUploads: storageStatus.capabilities.upload,
        useCache: cacheHealth.available,
        showOfflineMessage: false,
        showDegradedMessage: true,
        retryInterval: 15000,
        fallbackActions: [
          'Some storage features may be limited',
          'Uploads may be slower than usual',
          'Service should improve automatically',
        ],
      };
    }

    // Normal operation
    return {
      mode: 'normal',
      allowUploads: true,
      useCache: cacheHealth.available,
      showOfflineMessage: false,
      showDegradedMessage: false,
      retryInterval: 60000,
      fallbackActions: [],
    };
  }

  /**
   * Update availability and notify listeners
   */
  private updateAvailability(): void {
    const previousAvailability = { ...this.currentAvailability };
    this.currentAvailability = this.assessAvailability();

    // Log significant changes
    if (previousAvailability.recommendedStrategy.mode !== this.currentAvailability.recommendedStrategy.mode) {
      console.log(`Service mode changed: ${previousAvailability.recommendedStrategy.mode} → ${this.currentAvailability.recommendedStrategy.mode}`);
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.getAvailability());
      } catch (error) {
        console.error('Error in availability listener:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.listeners = [];
    console.log('ServiceAvailabilityManager cleanup completed');
  }
}