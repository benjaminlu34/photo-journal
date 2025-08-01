import { 
  validateFileMagicNumber, 
  validateFileUpload,
  MAGIC_NUMBERS,
  MAGIC_NUMBERS_GIF89A
} from '../../server/utils/photo-storage';
import fs from 'fs';
import path from 'path';

// Mock file data for testing
const createMockFile = (magicNumbers: number[]): Buffer => {
  return Buffer.from(new Uint8Array(magicNumbers));
};

// Test magic numbers for different image formats (padded to minimum 12 bytes)
const JPEG_MAGIC = [0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x00];
const GIF87A_MAGIC = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
const GIF89A_MAGIC = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
const WEBP_MAGIC = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

describe('Magic Number Validation', () => {
  describe('validateFileMagicNumber', () => {
    it('should validate JPEG files correctly', () => {
      const jpegBuffer = createMockFile(JPEG_MAGIC);
      const result = validateFileMagicNumber(jpegBuffer, 'image/jpeg');
      expect(result).toBeNull(); // null means validation passed
    });

    it('should validate PNG files correctly', () => {
      const pngBuffer = createMockFile(PNG_MAGIC);
      const result = validateFileMagicNumber(pngBuffer, 'image/png');
      expect(result).toBeNull();
    });

    it('should validate GIF87a files correctly', () => {
      const gif87aBuffer = createMockFile(GIF87A_MAGIC);
      const result = validateFileMagicNumber(gif87aBuffer, 'image/gif');
      expect(result).toBeNull();
    });

    it('should validate GIF89a files correctly', () => {
      const gif89aBuffer = createMockFile(GIF89A_MAGIC);
      const result = validateFileMagicNumber(gif89aBuffer, 'image/gif');
      expect(result).toBeNull();
    });

    it('should validate WebP files correctly', () => {
      const webpBuffer = createMockFile(WEBP_MAGIC);
      const result = validateFileMagicNumber(webpBuffer, 'image/webp');
      expect(result).toBeNull();
    });

    it('should reject files with wrong magic numbers', () => {
      const jpegBuffer = createMockFile(JPEG_MAGIC);
      const result = validateFileMagicNumber(jpegBuffer, 'image/png');
      expect(result).toContain('does not match PNG format');
    });

    it('should reject files that are too small', () => {
      const tinyBuffer = createMockFile([0xFF, 0xD8]);
      const result = validateFileMagicNumber(tinyBuffer, 'image/jpeg');
      expect(result).toContain('too small to validate');
    });

    it('should reject unsupported MIME types', () => {
      const buffer = createMockFile(JPEG_MAGIC);
      const result = validateFileMagicNumber(buffer, 'image/tiff');
      expect(result).toContain('Unsupported file type');
    });

    it('should reject WebP files without WEBP signature', () => {
      const webpWithoutSignature = createMockFile([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x00]); // Missing 'P'
      const result = validateFileMagicNumber(webpWithoutSignature, 'image/webp');
      expect(result).toContain('does not match WebP format');
    });
  });

  describe('Magic Number Constants', () => {
    it('should have correct magic numbers for JPEG', () => {
      expect(MAGIC_NUMBERS['image/jpeg']).toEqual(new Uint8Array([0xFF, 0xD8, 0xFF]));
    });

    it('should have correct magic numbers for PNG', () => {
      expect(MAGIC_NUMBERS['image/png']).toEqual(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    });

    it('should have correct magic numbers for GIF87a', () => {
      expect(MAGIC_NUMBERS['image/gif']).toEqual(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]));
    });

    it('should have correct magic numbers for GIF89a', () => {
      expect(MAGIC_NUMBERS_GIF89A).toEqual(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]));
    });

    it('should have correct magic numbers for WebP', () => {
      expect(MAGIC_NUMBERS['image/webp']).toEqual(new Uint8Array([0x52, 0x49, 0x46, 0x46]));
    });
  });

  describe('validateFileUpload Integration', () => {
    it('should pass validation for valid files with correct magic numbers', async () => {
      const mockFile = {
        fieldname: 'photo',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        destination: '/tmp',
        filename: 'test.jpg',
        path: '/tmp/test.jpg',
        stream: null as any,
        buffer: null as any
      };

      const jpegBuffer = createMockFile(JPEG_MAGIC);
      const result = await validateFileUpload(mockFile, jpegBuffer);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail validation for files with incorrect magic numbers', async () => {
      const mockFile = {
        fieldname: 'photo',
        originalname: 'fake.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 1024,
        destination: '/tmp',
        filename: 'fake.png',
        path: '/tmp/fake.png',
        stream: null as any,
        buffer: null as any
      };

      const jpegBuffer = createMockFile(JPEG_MAGIC); // JPEG magic but claiming to be PNG
      const result = await validateFileUpload(mockFile, jpegBuffer);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('does not match PNG format');
    });

    it('should fail validation for unsupported MIME types', async () => {
      const mockFile = {
        fieldname: 'photo',
        originalname: 'test.exe',
        encoding: '7bit',
        mimetype: 'application/x-executable',
        size: 1024,
        destination: '/tmp',
        filename: 'test.exe',
        path: '/tmp/test.exe',
        stream: null as any,
        buffer: null as any
      };

      const buffer = createMockFile([0x4D, 0x5A]); // DOS header
      const result = await validateFileUpload(mockFile, buffer);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should work without buffer parameter (basic validation only)', async () => {
      const mockFile = {
        fieldname: 'photo',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        destination: '/tmp',
        filename: 'test.jpg',
        path: '/tmp/test.jpg',
        stream: null as any,
        buffer: null as any
      };

      const result = await validateFileUpload(mockFile);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});

describe('Security Test Cases', () => {
  it('should prevent MIME type spoofing with JPEG header', () => {
    const jpegBuffer = createMockFile(JPEG_MAGIC);
    
    // Try to pass JPEG as PNG
    const result = validateFileMagicNumber(jpegBuffer, 'image/png');
    expect(result).toContain('does not match PNG format');
    
    // Try to pass JPEG as GIF
    const result2 = validateFileMagicNumber(jpegBuffer, 'image/gif');
    expect(result2).toContain('does not match GIF format');
  });

  it('should prevent MIME type spoofing with PNG header', () => {
    const pngBuffer = createMockFile(PNG_MAGIC);
    
    // Try to pass PNG as JPEG
    const result = validateFileMagicNumber(pngBuffer, 'image/jpeg');
    expect(result).toContain('does not match JPEG format');
  });

  it('should prevent files with no valid magic numbers', () => {
    const randomBuffer = createMockFile([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B]);
    
    // Try all supported MIME types
    expect(validateFileMagicNumber(randomBuffer, 'image/jpeg')).toContain('does not match JPEG format');
    expect(validateFileMagicNumber(randomBuffer, 'image/png')).toContain('does not match PNG format');
    expect(validateFileMagicNumber(randomBuffer, 'image/gif')).toContain('does not match GIF format');
    expect(validateFileMagicNumber(randomBuffer, 'image/webp')).toContain('does not match WebP format');
  });
});