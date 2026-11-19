import { lookup } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';
import { err, ok, type Result } from './errors.ts';

export interface SsrfCheckOptions {
  /** Only enabled in isolated local unit/mock tests. Never true in production. */
  allowInsecureHttp?: boolean;
  /** Skip DNS lookup when using an in-memory mock adapter. */
  skipDnsCheck?: boolean;
  /** When true (OPEN_PAYMENTS_MODE=test), restrict wallets strictly to official Interledger Testnet hosts. */
  testnetOnly?: boolean;
}

const TESTNET_ALLOWED_HOST_SUFFIX = '.interledger-test.dev';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a = 0, b = 0] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (isIPv4(mapped)) return isPrivateIpv4(mapped);
  }
  return false;
}

export function isBlockedIp(ip: string): boolean {
  if (isIPv4(ip)) return isPrivateIpv4(ip);
  if (isIPv6(ip)) return isPrivateIpv6(ip);
  return true;
}

/**
 * Normalizes a payment pointer (`$host/path`) or URL (`https://host/path`)
 * and enforces strict protocol and hostname safety against SSRF.
 */
export function normalizeWalletAddressUrl(
  rawInput: string,
  opts: SsrfCheckOptions = {},
): Result<string> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return err({
      code: 'INVALID_WALLET_ADDRESS',
      message: 'Wallet address is required.',
      retryable: false,
    });
  }

  const candidate = trimmed.startsWith('$') ? `https://${trimmed.slice(1)}` : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return err({
      code: 'INVALID_WALLET_ADDRESS',
      message:
        'Enter a valid Open Payments wallet address (e.g. https://ilp.interledger-test.dev/alice or $ilp.interledger-test.dev/alice).',
      retryable: false,
    });
  }

  const allowedProtocols = opts.allowInsecureHttp ? ['https:', 'http:'] : ['https:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return err({
      code: 'SSRF_BLOCKED',
      message: 'Wallet address must use HTTPS.',
      retryable: false,
    });
  }

  if (parsed.username || parsed.password) {
    return err({
      code: 'SSRF_BLOCKED',
      message: 'Wallet address must not contain embedded credentials.',
      retryable: false,
    });
  }

  const hostname = parsed.hostname.toLowerCase();
  const bareHost =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (
    !bareHost ||
    BLOCKED_HOSTNAMES.has(bareHost) ||
    bareHost.endsWith('.local') ||
    bareHost.endsWith('.internal')
  ) {
    return err({
      code: 'SSRF_BLOCKED',
      message: 'Private or local network wallet addresses are not permitted.',
      retryable: false,
    });
  }

  if ((isIPv4(bareHost) || isIPv6(bareHost)) && isBlockedIp(bareHost)) {
    return err({
      code: 'SSRF_BLOCKED',
      message: 'Private IP wallet addresses are not permitted.',
      retryable: false,
    });
  }

  if (opts.testnetOnly && !bareHost.endsWith(TESTNET_ALLOWED_HOST_SUFFIX)) {
    return err({
      code: 'SSRF_BLOCKED',
      message:
        'Test mode only permits official Interledger Test Wallet addresses (*.interledger-test.dev). Real-money wallets are blocked.',
      retryable: false,
    });
  }

  // Strip trailing slash for canonical Open Payments wallet address comparison
  const normalized = parsed.toString().replace(/\/+$/, '');
  return ok(normalized);
}

/**
 * Resolves the target hostname via DNS and verifies no resolved IP points to a
 * loopback, private, link-local, or cloud metadata address.
 */
export async function assertSafeRemoteUrl(
  urlStr: string,
  opts: SsrfCheckOptions = {},
): Promise<Result<string>> {
  const normalized = normalizeWalletAddressUrl(urlStr, opts);
  if (!normalized.ok) return normalized;
  if (opts.skipDnsCheck) return normalized;

  const parsed = new URL(normalized.value);
  const rawHost = parsed.hostname;
  const host = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost;
  if (isIPv4(host) || isIPv6(host)) {
    if (isBlockedIp(host)) {
      return err({
        code: 'SSRF_BLOCKED',
        message: 'Target IP address is blocked.',
        retryable: false,
      });
    }
    return normalized;
  }

  try {
    const records = await lookup(host, { all: true });
    if (records.length === 0) {
      return err({
        code: 'WALLET_DISCOVERY_FAILED',
        message: 'Could not resolve wallet address host.',
        retryable: true,
      });
    }
    for (const record of records) {
      if (isBlockedIp(record.address)) {
        return err({
          code: 'SSRF_BLOCKED',
          message: 'Wallet address resolved to a restricted network address.',
          retryable: false,
        });
      }
    }
    return normalized;
  } catch {
    return err({
      code: 'WALLET_DISCOVERY_FAILED',
      message: 'Unable to resolve wallet address host.',
      retryable: true,
    });
  }
}
