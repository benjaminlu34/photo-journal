import { describe, it, expect } from 'vitest';
import { PhotoStorageService, PhotoCacheService } from '../index';
import { compressImage, validateImageFile, shouldCompressImage } from '@/utils/image-compression';

describe('Photo Storage Integration', () => {
  it('should export all required services and utilities', () => {
    // Storage services
    expect(PhotoStorageService).toBeDefined();
    expect(PhotoCacheService).toBeDefined();
    
    // Compression utilities
    expect(compressImage).toBeDefined();
    expect(validateImageFile).toBeDefined();
    expect(shouldCompressImage).toBeDefined();
    
    // Service instances
    const photoService = PhotoStorageService.getInstance();
    const cacheService = PhotoCacheService.getInstance();
    
    expect(photoService).toBeDefined();
    expect(cacheService).toBeDefined();
  });

  it('should have correct service configurations', () => {
    const photoService = PhotoStorageService.getInstance();
    
    expect(photoService.getBucketName()).toBe('journal-images');
    expect(photoService.getSignedUrlTTL()).toBe(7 * 24 * 60 * 60); // 7 days
  });

  it('should validate file types correctly', () => {
    const validJpeg = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const validPng = new File(['test'], 'test.png', { type: 'image/png' });
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    expect(validateImageFile(validJpeg).isValid).toBe(true);
    expect(validateImageFile(validPng).isValid).toBe(true);
    expect(validateImageFile(invalidFile).isValid).toBe(false);
  });

  it('should recommend compression for appropriate files', () => {
    const largeJpeg = new File(['x'.repeat(200 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    const smallJpeg = new File(['small'], 'small.jpg', { type: 'image/jpeg' });
    const webpFile = new File(['x'.repeat(200 * 1024)], 'optimized.webp', { type: 'image/webp' });
    
    expect(shouldCompressImage(largeJpeg)).toBe(true);
    expect(shouldCompressImage(smallJpeg)).toBe(false);
    expect(shouldCompressImage(webpFile)).toBe(false);
  });
});