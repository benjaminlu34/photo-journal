/**
 * Storage Health Monitoring Service
 * Monitors storage service availability and provides graceful degradation
 */

import { supabase } from '@/lib/supabase';
import { StorageError, StorageErrorFactory, StorageErrorType } from './storage-errors';

export interface StorageHealthStatus {
  isAvailable: boolean;
  lastChecked: Date;
  responseTime?: number;
  error?: StorageError;
  degradedMode: boolean;
  capabilities: {
    upload: boolean;
    download: boolean;
    signedUrls: boolean;
    delete: boolean;
  };
}

export interface HealthCheckResult {
  success: boolean;
  responseTime: number;
  error?: Error;
}

export class StorageHealthService {
  private static instance: StorageHealthService;
  private healthStatus: StorageHealthStatus;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 30000; // 30 seconds
  private readonly timeoutMs = 10000; // 10 seconds
  private listeners: ((status: StorageHealthStatus) => void)[] = [];

  static getInstance(): StorageHealthService {
    if (!StorageHealthService.instance) {
      StorageHealthService.instance = new StorageHealthService();
    }
    return StorageHealthService.instance;
  }

  constructor() {
    this.healthStatus = {
      isAvailable: true, // Assume available initially
      lastChecked: new Date(),
      degradedMode: false,
      capabilities: {
        upload: true,
        download: true,
        signedUrls: true,
        delete: true,
      },
    };
  }

  /**
   * Start health monitoring
   */
  startMonitoring(): void {
    if (this.checkInterval) {
      return; // Already monitoring
    }

    // Initial check
    this.performHealthCheck();

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.checkIntervalMs);

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    console.log('Storage health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));

    console.log('Storage health monitoring stopped');
  }

  /**
   * Get current health status
   */
  getHealthStatus(): StorageHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Check if storage is available
   */
  isStorageAvailable(): boolean {
    return this.healthStatus.isAvailable && navigator.onLine;
  }

  /**
   * Check if in degraded mode
   */
  isDegraded(): boolean {
    return this.healthStatus.degradedMode;
  }

  /**
   * Subscribe to health status changes
   */
  subscribe(listener: (status: StorageHealthStatus) => void): () => void {
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
   * Force a health check
   */
  async checkHealth(): Promise<StorageHealthStatus> {
    await this.performHealthCheck();
    return this.getHealthStatus();
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check if device is online
      if (!navigator.onLine) {
        this.updateHealthStatus({
          isAvailable: false,
          lastChecked: new Date(),
          degradedMode: true,
          error: StorageErrorFactory.createNetworkError(new Error('Device is offline'), true),
          capabilities: {
            upload: false,
            download: false,
            signedUrls: false,
            delete: false,
          },
        });
        return;
      }

      // Test basic connectivity to Supabase
      const connectivityResult = await this.testConnectivity();
      const responseTime = Date.now() - startTime;

      if (!connectivityResult.success) {
        this.updateHealthStatus({
          isAvailable: false,
          lastChecked: new Date(),
          responseTime,
          degradedMode: true,
          error: StorageErrorFactory.createServiceUnavailableError('storage'),
          capabilities: {
            upload: false,
            download: false,
            signedUrls: false,
            delete: false,
          },
        });
        return;
      }

      // Test individual capabilities
      const capabilities = await this.testCapabilities();

      // Determine if we're in degraded mode
      const degradedMode = !capabilities.upload || !capabilities.download || !capabilities.signedUrls;

      this.updateHealthStatus({
        isAvailable: true,
        lastChecked: new Date(),
        responseTime,
        degradedMode,
        capabilities,
        error: undefined,
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.updateHealthStatus({
        isAvailable: false,
        lastChecked: new Date(),
        responseTime,
        degradedMode: true,
        error: StorageErrorFactory.createFromError(error instanceof Error ? error : new Error('Health check failed')),
        capabilities: {
          upload: false,
          download: false,
          signedUrls: false,
          delete: false,
        },
      });
    }
  }

  /**
   * Test basic connectivity to Supabase
   */
  private async testConnectivity(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test authentication status (lightweight check)
      const { data, error } = await Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.timeoutMs)
        ),
      ]);

      const responseTime = Date.now() - startTime;

      if (error && !error.message.includes('session')) {
        // Only fail if it's not a session-related error
        return { success: false, responseTime, error };
      }

      return { success: true, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return { 
        success: false, 
        responseTime, 
        error: error instanceof Error ? error : new Error('Connectivity test failed') 
      };
    }
  }

  /**
   * Test individual storage capabilities
   */
  private async testCapabilities(): Promise<StorageHealthStatus['capabilities']> {
    const capabilities = {
      upload: false,
      download: false,
      signedUrls: false,
      delete: false,
    };

    try {
      // Test bucket access (lightweight operation)
      const { data, error } = await supabase.storage
        .from('journal-images')
        .list('', { limit: 1 });

      if (!error) {
        capabilities.download = true;
        capabilities.signedUrls = true; // If we can list, we can likely create signed URLs
        capabilities.upload = true; // If we can access bucket, we can likely upload
        capabilities.delete = true; // If we can access bucket, we can likely delete
      } else {
        // Partial degradation - some operations might still work
        console.warn('Storage capability test failed:', error);
        
        // Try to determine which capabilities are available based on error
        if (!error.message.includes('permission') && !error.message.includes('unauthorized')) {
          // Network or service issue, assume all capabilities are down
          capabilities.upload = false;
          capabilities.download = false;
          capabilities.signedUrls = false;
          capabilities.delete = false;
        } else {
          // Permission issue, might be session-related
          capabilities.upload = false;
          capabilities.download = false;
          capabilities.signedUrls = false;
          capabilities.delete = false;
        }
      }
    } catch (error) {
      console.error('Capability test error:', error);
      // All capabilities assumed down on error
    }

    return capabilities;
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    console.log('Device came online, checking storage health');
    this.performHealthCheck();
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    console.log('Device went offline');
    this.updateHealthStatus({
      isAvailable: false,
      lastChecked: new Date(),
      degradedMode: true,
      error: StorageErrorFactory.createNetworkError(new Error('Device is offline'), true),
      capabilities: {
        upload: false,
        download: false,
        signedUrls: false,
        delete: false,
      },
    });
  }

  /**
   * Update health status and notify listeners
   */
  private updateHealthStatus(updates: Partial<StorageHealthStatus>): void {
    const previousStatus = { ...this.healthStatus };
    this.healthStatus = { ...this.healthStatus, ...updates };

    // Log significant changes
    if (previousStatus.isAvailable !== this.healthStatus.isAvailable) {
      console.log(`Storage availability changed: ${this.healthStatus.isAvailable ? 'available' : 'unavailable'}`);
    }

    if (previousStatus.degradedMode !== this.healthStatus.degradedMode) {
      console.log(`Storage mode changed: ${this.healthStatus.degradedMode ? 'degraded' : 'normal'}`);
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.getHealthStatus());
      } catch (error) {
        console.error('Error in health status listener:', error);
      }
    });
  }

  /**
   * Get recommended fallback strategy based on current health
   */
  getFallbackStrategy(): {
    useCache: boolean;
    allowUploads: boolean;
    showOfflineMessage: boolean;
    retryInterval: number;
  } {
    if (!this.healthStatus.isAvailable) {
      return {
        useCache: true,
        allowUploads: false,
        showOfflineMessage: true,
        retryInterval: 5000, // 5 seconds
      };
    }

    if (this.healthStatus.degradedMode) {
      return {
        useCache: true,
        allowUploads: this.healthStatus.capabilities.upload,
        showOfflineMessage: false,
        retryInterval: 10000, // 10 seconds
      };
    }

    return {
      useCache: false,
      allowUploads: true,
      showOfflineMessage: false,
      retryInterval: 30000, // 30 seconds
    };
  }
}