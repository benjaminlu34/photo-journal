/**
 * Minimal storage health service for BaseStorageService compatibility
 * Simplified version that always reports healthy status
 */

export interface StorageHealthStatus {
  isAvailable: boolean;
  capabilities: {
    signedUrls: boolean;
    delete: boolean;
  };
  error?: Error;
}

export class StorageHealthService {
  private static instance: StorageHealthService;

  static getInstance(): StorageHealthService {
    if (!StorageHealthService.instance) {
      StorageHealthService.instance = new StorageHealthService();
    }
    return StorageHealthService.instance;
  }

  isStorageAvailable(): boolean {
    return true; // Always available for simplified implementation
  }

  getHealthStatus(): StorageHealthStatus {
    return {
      isAvailable: true,
      capabilities: {
        signedUrls: true,
        delete: true,
      },
    };
  }
}