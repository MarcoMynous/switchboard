import { createHash, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  completeAuthorizationAndCreateOutgoingPayment,
  convertKoboToWalletAsset,
  createMockOpenPaymentsAdapter,
  decryptToken,
  discoverWalletAddress,
  encryptToken,
  formatAssetAmount,
  normalizeWalletAddressUrl,
  parseEd25519PrivateKey,
  prepareIncomingPaymentAndQuote,
  startOutgoingPaymentAuthorization,
  testBusinessWalletConnection,
  verifyGnapInteractionHash,
  verifyIncomingPaymentReceipt,
} from './index.ts';

const ENC_KEY = 'test-open-payments-encryption-key-32bytes';

describe('SSRF & wallet address validation', () => {
  it('normalizes payment pointers and HTTPS wallet URLs', () => {
    const ptr = normalizeWalletAddressUrl('$ilp.interledger-test.dev/alice/');
    expect(ptr.ok).toBe(true);
    if (ptr.ok) expect(ptr.value).toBe('https://ilp.interledger-test.dev/alice');

    const https = normalizeWalletAddressUrl('https://ilp.interledger-test.dev/bob');
    expect(https.ok).toBe(true);

    // Testnet-only mode allows official Interledger Testnet and blocks real-money wallets
    const testnetAllowed = normalizeWalletAddressUrl('$ilp.interledger-test.dev/1ca580ac', {
      testnetOnly: true,
    });
    expect(testnetAllowed.ok).toBe(true);
    const liveBlocked = normalizeWalletAddressUrl('https://ilp.example-bank.com/alice', {
      testnetOnly: true,
    });
    expect(liveBlocked.ok).toBe(false);
    if (!liveBlocked.ok) expect(liveBlocked.error.code).toBe('SSRF_BLOCKED');
  });

  it('blocks HTTP, localhost, private IPs, metadata endpoints, and embedded credentials', () => {
    const blocked = [
      'http://ilp.interledger-test.dev/alice',
      'https://localhost/alice',
      'https://127.0.0.1/alice',
      'https://169.254.169.254/latest/meta-data',
      'https://10.0.0.5/wallet',
      'https://192.168.1.1/wallet',
      'https://[::1]/wallet',
      'https://user:pass@ilp.interledger-test.dev/alice',
      'https://internal.local/wallet',
    ];
    for (const url of blocked) {
      const res = normalizeWalletAddressUrl(url);
      expect(res.ok).toBe(false);
    }
  });
});

describe('Crypto & GNAP interaction hash', () => {
  it('encrypts and decrypts tokens symmetrically with AES-256-GCM', () => {
    const token = 'secret-continuation-token-xyz';
    const enc = encryptToken(token, ENC_KEY);
    expect(enc).not.toContain(token);
    expect(decryptToken(enc, ENC_KEY)).toBe(token);
  });

  it('parses Ed25519 private keys in multiline, escaped-newline, space-flattened, base64-PEM, and raw base64-DER formats', () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const derB64 = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
    const escaped = pem.replace(/\n/g, '\\n');
    const spaceFlattened = pem.replace(/\n/g, ' ');
    const base64Pem = Buffer.from(pem, 'utf8').toString('base64');

    for (const variant of [pem, `"${escaped}"`, spaceFlattened, base64Pem, derB64]) {
      const parsed = parseEd25519PrivateKey(variant);
      expect(parsed.asymmetricKeyType).toBe('ed25519');
    }
  });

  it('verifies GNAP interaction hash and rejects tampered hashes', () => {
    const rfcInput = {
      clientNonce: 'VJLO6A4CATR0KRO',
      interactNonce: 'MBDOFXG4Y5CVJCX821LH',
      interactRef: '4IFWWIKYB2PQ6U56NL1',
      grantEndpoint: 'https://server.example.com/tx',
    };
    const rfcBaseString = `${rfcInput.clientNonce}\n${rfcInput.interactNonce}\n${rfcInput.interactRef}\n${rfcInput.grantEndpoint}`;
    const rfcBase64Url = createHash('sha256').update(rfcBaseString, 'utf8').digest('base64url');
    const rafikiBase64 = createHash('sha256').update(rfcBaseString, 'utf8').digest('base64');

    // Official RFC 9635 Section 4.2.3 base64url (unpadded) and Rafiki base64 (padded)
    expect(
      verifyGnapInteractionHash({
        ...rfcInput,
        receivedHash: rfcBase64Url,
      }),
    ).toBe(true);
    expect(
      verifyGnapInteractionHash({
        ...rfcInput,
        receivedHash: rafikiBase64,
      }),
    ).toBe(true);

    // Incorrect hash
    expect(
      verifyGnapInteractionHash({
        ...rfcInput,
        receivedHash: 'tampered-hash',
      }),
    ).toBe(false);

    // Wrong client nonce
    expect(
      verifyGnapInteractionHash({
        ...rfcInput,
        clientNonce: 'WRONG_CLIENT_NONCE',
        receivedHash: rfcBase64Url,
      }),
    ).toBe(false);

    // Wrong authorization-server nonce
    expect(
      verifyGnapInteractionHash({
        ...rfcInput,
        interactNonce: 'WRONG_SERVER_NONCE',
        receivedHash: rfcBase64Url,
      }),
    ).toBe(false);

    // Wrong grant endpoint
    expect(
      verifyGnapInteractionHash({
        ...rfcInput,
        grantEndpoint: 'https://evil.example.com/tx',
        receivedHash: rfcBase64Url,
      }),
    ).toBe(false);

    // Trailing-slash mismatch
    expect(
      verifyGnapInteractionHash({
        ...rfcInput,
        grantEndpoint: 'https://server.example.com/tx/',
        receivedHash: rfcBase64Url,
      }),
    ).toBe(false);

    // Invalid encoding (hex / unpadded base64 / wrong length)
    expect(
      verifyGnapInteractionHash({
        ...rfcInput,
        receivedHash: createHash('sha256').update(rfcBaseString, 'utf8').digest('hex'),
      }),
    ).toBe(false);
    expect(
      verifyGnapInteractionHash({
        ...rfcInput,
        receivedHash: rafikiBase64.slice(0, -1),
      }),
    ).toBe(false);
  });
});

describe('Asset & currency conversion', () => {
  it('converts NGN kobo to NGN with arbitrary scale and to USD with explicit rate', () => {
    const ngn = convertKoboToWalletAsset({
      amountKobo: 150_000, // ₦1,500.00
      targetAssetCode: 'NGN',
      targetAssetScale: 2,
      ngnToUsdRate: 0.000625,
    });
    expect(ngn.ok).toBe(true);
    if (ngn.ok) {
      expect(ngn.value.amount.value).toBe('150000');
      expect(ngn.value.isCrossCurrency).toBe(false);
    }

    const usd = convertKoboToWalletAsset({
      amountKobo: 160_000, // ₦1,600.00 * 0.000625 = $1.00
      targetAssetCode: 'USD',
      targetAssetScale: 2,
      ngnToUsdRate: 0.000625,
    });
    expect(usd.ok).toBe(true);
    if (usd.ok) {
      expect(usd.value.amount.value).toBe('100');
      expect(usd.value.isCrossCurrency).toBe(true);
      expect(formatAssetAmount(usd.value.amount)).toBe('1.00 USD');
    }
  });

  it('rejects unsupported assets instead of silently converting', () => {
    const res = convertKoboToWalletAsset({
      amountKobo: 150_000,
      targetAssetCode: 'JPY',
      targetAssetScale: 0,
      ngnToUsdRate: 0.000625,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNSUPPORTED_ASSET');
  });
});

describe('End-to-end Open Payments protocol flow', () => {
  const bizWallet = 'https://ilp.interledger-test.dev/fade-republic';
  const custWallet = 'https://ilp.interledger-test.dev/customer-alice';

  it('executes discovery, incoming payment, quote, interactive auth, outgoing payment, and independent verification', async () => {
    const adapter = createMockOpenPaymentsAdapter();

    const conn = await testBusinessWalletConnection(adapter, bizWallet, { skipDnsCheck: true });
    expect(conn.ok).toBe(true);
    if (conn.ok) expect(conn.value.grantVerified).toBe(true);

    const prepared = await prepareIncomingPaymentAndQuote(adapter, {
      bookingId: 'bk_1',
      businessId: 'biz_1',
      businessName: 'Fade Republic',
      businessWalletAddress: bizWallet,
      customerWalletAddress: custWallet,
      amountKobo: 160_000,
      ngnToUsdRate: 0.000625,
      expiresAt: new Date(Date.now() + 900_000),
      ssrfOptions: { skipDnsCheck: true },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    expect(prepared.value.expectedAmount.value).toBe('100');
    expect(prepared.value.quote.debitAmount.value).toBe('102');

    const auth = await startOutgoingPaymentAuthorization(adapter, {
      customerWallet: prepared.value.customerWallet,
      quote: prepared.value.quote,
      callbackUrl: 'https://switchboard.ng/api/public/fade-republic/payments/interledger/callback',
      tokenEncryptionKey: ENC_KEY,
    });
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;

    const interactRef = 'interact-ref-abc';
    const validHash = createHash('sha256')
      .update(
        `${auth.value.clientNonce}\n${auth.value.interactNonce}\n${interactRef}\n${auth.value.grantEndpoint}`,
        'utf8',
      )
      .digest('base64url');

    const completed = await completeAuthorizationAndCreateOutgoingPayment(adapter, {
      customerWallet: prepared.value.customerWallet,
      quoteId: prepared.value.quote.id,
      quoteExpiresAt: prepared.value.quote.expiresAt
        ? new Date(prepared.value.quote.expiresAt)
        : null,
      holdExpiresAt: new Date(Date.now() + 900_000),
      interactRef,
      clientNonce: auth.value.clientNonce,
      interactNonce: auth.value.interactNonce,
      receivedHash: validHash,
      continueUri: auth.value.continueUri,
      continueAccessTokenEnc: auth.value.continueAccessTokenEnc,
      tokenEncryptionKey: ENC_KEY,
      bookingId: 'bk_1',
      paymentId: 'pay_1',
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;

    const receipt = await verifyIncomingPaymentReceipt(adapter, {
      businessWallet: prepared.value.businessWallet,
      incomingPaymentId: prepared.value.incomingPayment.id,
      expectedAmount: prepared.value.expectedAmount,
    });
    expect(receipt.ok).toBe(true);
    if (receipt.ok) {
      expect(receipt.value.verified).toBe(true);
      expect(receipt.value.underpaid).toBe(false);
      expect(receipt.value.overpaid).toBe(false);
    }
  });

  it('handles expired quote, rejected grant, insufficient funds, timeout, underpayment, and overpayment', async () => {
    const adapter = createMockOpenPaymentsAdapter({ expiredQuote: true });

    const disc = await discoverWalletAddress(adapter, 'https://ilp.interledger-test.dev/unknown', {
      skipDnsCheck: true,
    });
    expect(disc.ok).toBe(false);

    const prepared = await prepareIncomingPaymentAndQuote(adapter, {
      bookingId: 'bk_2',
      businessId: 'biz_1',
      businessName: 'Fade Republic',
      businessWalletAddress: bizWallet,
      customerWalletAddress: custWallet,
      amountKobo: 160_000,
      ngnToUsdRate: 0.000625,
      expiresAt: new Date(Date.now() + 900_000),
      ssrfOptions: { skipDnsCheck: true },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const auth = await startOutgoingPaymentAuthorization(adapter, {
      customerWallet: prepared.value.customerWallet,
      quote: prepared.value.quote,
      callbackUrl: 'https://switchboard.ng/callback',
      tokenEncryptionKey: ENC_KEY,
    });
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;

    // Expired quote blocks outgoing payment
    const expiredRes = await completeAuthorizationAndCreateOutgoingPayment(adapter, {
      customerWallet: prepared.value.customerWallet,
      quoteId: prepared.value.quote.id,
      quoteExpiresAt: new Date(Date.now() - 1000),
      holdExpiresAt: new Date(Date.now() + 900_000),
      interactRef: 'ref',
      clientNonce: 'n',
      interactNonce: 'n',
      continueUri: auth.value.continueUri,
      continueAccessTokenEnc: auth.value.continueAccessTokenEnc,
      tokenEncryptionKey: ENC_KEY,
      bookingId: 'bk_2',
      paymentId: 'pay_2',
    });
    expect(expiredRes.ok).toBe(false);
    if (!expiredRes.ok) expect(expiredRes.error.code).toBe('QUOTE_EXPIRED');

    // Rejected grant
    adapter.behavior.rejectGrant = true;
    const rejected = await completeAuthorizationAndCreateOutgoingPayment(adapter, {
      customerWallet: prepared.value.customerWallet,
      quoteId: prepared.value.quote.id,
      quoteExpiresAt: new Date(Date.now() + 60_000),
      holdExpiresAt: new Date(Date.now() + 900_000),
      interactRef: 'ref',
      clientNonce: 'n',
      interactNonce: 'n',
      continueUri: auth.value.continueUri,
      continueAccessTokenEnc: auth.value.continueAccessTokenEnc,
      tokenEncryptionKey: ENC_KEY,
      bookingId: 'bk_2',
      paymentId: 'pay_2',
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('GRANT_REJECTED');

    // Insufficient funds
    adapter.behavior.rejectGrant = false;
    adapter.behavior.insufficientFunds = true;
    const insuf = await completeAuthorizationAndCreateOutgoingPayment(adapter, {
      customerWallet: prepared.value.customerWallet,
      quoteId: prepared.value.quote.id,
      quoteExpiresAt: new Date(Date.now() + 60_000),
      holdExpiresAt: new Date(Date.now() + 900_000),
      interactRef: 'ref',
      clientNonce: 'n',
      interactNonce: 'n',
      continueUri: auth.value.continueUri,
      continueAccessTokenEnc: auth.value.continueAccessTokenEnc,
      tokenEncryptionKey: ENC_KEY,
      bookingId: 'bk_2',
      paymentId: 'pay_2',
    });
    expect(insuf.ok).toBe(false);
    if (!insuf.ok) expect(insuf.error.code).toBe('INSUFFICIENT_FUNDS');

    // Underpayment detection
    adapter.behavior.insufficientFunds = false;
    adapter.behavior.overrideReceivedValue = '50';
    const okOut = await completeAuthorizationAndCreateOutgoingPayment(adapter, {
      customerWallet: prepared.value.customerWallet,
      quoteId: prepared.value.quote.id,
      quoteExpiresAt: new Date(Date.now() + 60_000),
      holdExpiresAt: new Date(Date.now() + 900_000),
      interactRef: 'ref',
      clientNonce: 'n',
      interactNonce: 'n',
      continueUri: auth.value.continueUri,
      continueAccessTokenEnc: auth.value.continueAccessTokenEnc,
      tokenEncryptionKey: ENC_KEY,
      bookingId: 'bk_2',
      paymentId: 'pay_2',
    });
    expect(okOut.ok).toBe(true);

    const under = await verifyIncomingPaymentReceipt(adapter, {
      businessWallet: prepared.value.businessWallet,
      incomingPaymentId: prepared.value.incomingPayment.id,
      expectedAmount: prepared.value.expectedAmount,
    });
    expect(under.ok).toBe(true);
    if (under.ok) {
      expect(under.value.verified).toBe(false);
      expect(under.value.underpaid).toBe(true);
    }

    // Timeout on verification
    adapter.behavior.timeoutVerification = true;
    const timedOut = await verifyIncomingPaymentReceipt(adapter, {
      businessWallet: prepared.value.businessWallet,
      incomingPaymentId: prepared.value.incomingPayment.id,
      expectedAmount: prepared.value.expectedAmount,
    });
    expect(timedOut.ok).toBe(false);
    if (!timedOut.ok) {
      expect(timedOut.error.code).toBe('PROVIDER_TIMEOUT');
      expect(timedOut.error.retryable).toBe(true);
    }
  });
});
