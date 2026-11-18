import pino from 'pino';

const PHONE_KEYS = new Set(['phone', 'phone_e164', 'phoneE164', 'from', 'wa_id']);

/** Keep the last 4 digits so support can still match a customer. */
export function maskPhone(value: unknown): string {
  const digits = String(value).replace(/\D/g, '');
  return digits.length <= 4 ? '****' : `***${digits.slice(-4)}`;
}

// I8: secrets and signatures never reach logs; phone numbers keep the last 4 only.
const redactPaths = [
  'authorization',
  'cookie',
  'accessToken',
  'continueAccessToken',
  'outgoingAccessToken',
  'privateKeyPem',
  '*.authorization',
  '*.cookie',
  '*.accessToken',
  '*.continueAccessToken',
  '*.outgoingAccessToken',
  '*.privateKeyPem',
  '*["x-korapay-signature"]',
  '*["x-hub-signature-256"]',
  '*["signature"]',
  '*["signature-input"]',
  '*.headers.authorization',
  '*.headers.cookie',
  '*.headers["x-korapay-signature"]',
  '*.headers["x-hub-signature-256"]',
  '*.headers["signature"]',
  '*.headers["signature-input"]',
  ...[...PHONE_KEYS].flatMap((k) => [k, `*.${k}`]),
];

export function createLogger(
  options: pino.LoggerOptions = {},
  destination?: pino.DestinationStream,
) {
  return pino(
    {
      base: { service: 'api' },
      redact: {
        paths: redactPaths,
        censor: (value, path) => {
          const key = path.at(-1);
          return key && PHONE_KEYS.has(key) ? maskPhone(value) : '[redacted]';
        },
      },
      ...options,
    },
    destination,
  );
}

export type Logger = pino.Logger;
