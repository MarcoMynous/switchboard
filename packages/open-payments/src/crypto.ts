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

function decodeSha256HashBytes(raw: string): Buffer | null {
  const trimmed = raw.trim();
  // RFC 9635 Section 4.2.3: unpadded Base64URL (43 chars for 32-byte SHA-256 digest)
  if (/^[A-Za-z0-9_-]{43}$/.test(trimmed)) {
    const buf = Buffer.from(trimmed, 'base64url');
    return buf.length === 32 ? buf : null;
  }
  // Interledger Rafiki (draft GNAP): standard padded Base64 (44 chars ending with '=')
  if (/^[A-Za-z0-9+/]{43}=$/.test(trimmed)) {
    const buf = Buffer.from(trimmed, 'base64');
    return buf.length === 32 ? buf : null;
  }
  return null;
}

/**
 * Verifies the GNAP interaction hash returned on redirect callback:
 * SHA-256(clientNonce + "\n" + interactNonce + "\n" + interactRef + "\n" + grantEndpoint)
 * Accepts RFC 9635 unpadded Base64URL and Rafiki's standard Base64 encoding,
 * comparing the decoded 32-byte digests in constant time.
 */
export function verifyGnapInteractionHash(input: {
  clientNonce: string;
  interactNonce: string;
  interactRef: string;
  grantEndpoint: string;
  receivedHash: string;
}): boolean {
  const receivedBytes = decodeSha256HashBytes(input.receivedHash);
  if (!receivedBytes) return false;

  const baseString = [
    input.clientNonce,
    input.interactNonce,
    input.interactRef,
    input.grantEndpoint,
  ].join('\n');
  const expectedBytes = createHash('sha256').update(baseString, 'utf8').digest();
  if (expectedBytes.length !== receivedBytes.length) return false;
  return timingSafeEqual(expectedBytes, receivedBytes);
}
