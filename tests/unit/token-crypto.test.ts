import { describe, it, expect, beforeAll } from 'vitest';
import { encryptToken, decryptToken } from '../../server/utils/token-crypto';

describe('token-crypto AES-GCM', () => {
  beforeAll(() => {
    process.env.OAUTH_ENCRYPTION_SECRET = 'test-secret-123';
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
});


