import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encryptToken, decryptToken } from '../../server/utils/token-crypto';

describe('token-crypto AES-GCM', () => {
  let originalSecret: string | undefined;
  
  beforeAll(() => {
    originalSecret = process.env.OAUTH_ENCRYPTION_SECRET;
    process.env.OAUTH_ENCRYPTION_SECRET = 'test-secret-123';
  });
  
  afterAll(() => {
    if (originalSecret) {
      process.env.OAUTH_ENCRYPTION_SECRET = originalSecret;
    } else {
      delete process.env.OAUTH_ENCRYPTION_SECRET;
    }
  });

  it('roundtrips plaintext through encrypt/decrypt', () => {
    const plaintext = 'ya29.a0AfB_by_example_access_token';
    const encrypted = encryptToken(plaintext, 'user-123');
    expect(typeof encrypted).toBe('string');
    const decrypted = decryptToken(encrypted, 'user-123');
    expect(decrypted).toBe(plaintext);
  });

  it('fails to decrypt tampered payload', () => {
    const plaintext = 'access-token';
    const encrypted = encryptToken(plaintext, 'user-123');
    const tampered = encrypted.slice(0, -2) + 'xx';
    expect(() => decryptToken(tampered, 'user-123')).toThrow();
  });

  it('fails if AAD mismatches', () => {
    const token = encryptToken('tkn', 'user-A');
    expect(() => decryptToken(token, 'user-B')).toThrow();
  });

  it('enforces salt requirement in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSalt = process.env.OAUTH_ENCRYPTION_SALT;
    
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.OAUTH_ENCRYPTION_SALT;
      
      expect(() => encryptToken('test-token')).toThrow('OAUTH_ENCRYPTION_SALT must be set in production');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalSalt) process.env.OAUTH_ENCRYPTION_SALT = originalSalt;
    }
  });
});


