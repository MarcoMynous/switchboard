import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export function generateOpaqueToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function deriveAesKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptToken(plaintext: string, secret: string): string {
  const key = deriveAesKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptToken(payload: string, secret: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }
  const [ivB64, tagB64, dataB64] = parts;
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted token parts');
  }
  const key = deriveAesKey(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Verifies the GNAP interaction hash returned on redirect callback:
 * SHA-256(clientNonce + "\n" + interactNonce + "\n" + interactRef + "\n" + grantEndpoint)
 * encoded as base64url (unpadded).
 */
export function verifyGnapInteractionHash(input: {
  clientNonce: string;
  interactNonce: string;
  interactRef: string;
  grantEndpoint: string;
  receivedHash: string;
}): boolean {
  const baseString = [
    input.clientNonce,
    input.interactNonce,
    input.interactRef,
    input.grantEndpoint,
  ].join('\n');
  const expected = createHash('sha256').update(baseString, 'utf8').digest('base64url');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(input.receivedHash.trim(), 'utf8');
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
