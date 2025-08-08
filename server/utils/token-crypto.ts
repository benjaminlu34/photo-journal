import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);

const TOKEN_VERSION = 1; // Increment on key/format change
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16; // AES-GCM tag length

let cachedEncryptionKey: Buffer | null = null;
let cachedKeyConfig: string | null = null;

async function getEncryptionKey(): Promise<Buffer> {
  const secret = process.env.OAUTH_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('Server configuration error: OAUTH_ENCRYPTION_SECRET must be set');
  }

  const salt = process.env.OAUTH_ENCRYPTION_SALT;
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
  const currentConfig = `${secretHash}:${salt || 'fallback'}:${process.env.NODE_ENV || 'development'}`;

  if (cachedEncryptionKey && cachedKeyConfig === currentConfig) {
    return cachedEncryptionKey;
  }

  const useSalt = salt || `photo-journal-dev-salt-${process.env.NODE_ENV || 'development'}`;
  // crypto.scrypt's default cost params are already reasonable; tweak only if needed
  cachedEncryptionKey = (await scryptAsync(secret, useSalt, 32)) as Buffer;

  cachedKeyConfig = currentConfig;
  return cachedEncryptionKey;
}

export async function encryptToken(plaintext: string, associatedData?: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (associatedData) {
    cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  }

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([
    Buffer.from([TOKEN_VERSION]),
    iv,
    ciphertext,
    authTag
  ]);

  return payload.toString('base64url');
}

export async function decryptToken(payloadBase64Url: string, associatedData?: string): Promise<string> {
  try {
    const buf = Buffer.from(payloadBase64Url, 'base64url');
    if (buf.length < 1 + IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted payload');
    }

    const version = buf[0];
    if (version !== TOKEN_VERSION) {
      throw new Error('Invalid encrypted payload');
    }

    const iv = buf.subarray(1, 1 + IV_LENGTH);
    const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH);
    const ciphertext = buf.subarray(1 + IV_LENGTH, buf.length - AUTH_TAG_LENGTH);

    const key = await getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    if (associatedData) {
      decipher.setAAD(Buffer.from(associatedData, 'utf8'));
    }
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return plaintext;
  } catch {
    // Generic error to avoid information leaks
    throw new Error('Invalid encrypted payload');
  }
}
