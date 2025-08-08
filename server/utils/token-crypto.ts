import crypto from 'crypto';

/**
 * AES-256-GCM encryption utilities for short-lived OAuth tokens.
 *
 * Security notes:
 * - Uses env var OAUTH_ENCRYPTION_SECRET to derive a 256-bit key (SHA-256).
 * - Returns base64url payload of [iv (12b)] + [ciphertext] + [authTag (16b)].
 * - No server-side storage; caller is responsible for persisting encrypted blobs if needed.
 */

function getEncryptionKey(): Buffer {
  const secret = process.env.OAUTH_ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('Server configuration error: OAUTH_ENCRYPTION_SECRET not set');
  }
  // Memory-hard KDF to slow brute-force; N=2^14, r=8, p=1 (moderate), 32-byte key
  const salt = process.env.OAUTH_ENCRYPTION_SALT || 'photo-journal-dev-salt';
  return crypto.scryptSync(secret, salt, 32, { N: 1 << 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

export function encryptToken(plaintext: string, associatedData?: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // GCM recommended IV length
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (associatedData) {
    cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  }
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, ciphertext, authTag]).toString('base64url');
  return payload;
}

export function decryptToken(payloadBase64Url: string, associatedData?: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(payloadBase64Url, 'base64url');
  if (buf.length < 12 + 16) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(buf.length - 16);
  const ciphertext = buf.subarray(12, buf.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  if (associatedData) {
    decipher.setAAD(Buffer.from(associatedData, 'utf8'));
  }
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return plaintext;
}


