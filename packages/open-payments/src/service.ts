import { isFinalizedGrantWithAccessToken, isPendingGrant } from '@interledger/open-payments';
import type {
  Grant,
  IncomingPayment,
  OpenPaymentsAdapter,
  OutgoingPayment,
  PendingGrant,
  Quote,
  WalletAddress,
} from './adapter.ts';
import {
  decryptToken,
  encryptToken,
  generateOpaqueToken,
  sha256Hex,
  verifyGnapInteractionHash,
} from './crypto.ts';
import { err, type OpenPaymentsDomainError, ok, type Result } from './errors.ts';
import { type AssetAmount, compareMinorUnits, convertKoboToWalletAsset } from './money.ts';
import { assertSafeRemoteUrl, type SsrfCheckOptions } from './ssrf.ts';

export interface DiscoveredWallet {
  id: string;
  publicName?: string;
  assetCode: string;
  assetScale: number;
  authServer: string;
  resourceServer: string;
}

export interface PrepareDepositInput {
  bookingId: string;
  businessId: string;
  businessName: string;
  businessWalletAddress: string;
  customerWalletAddress: string;
  amountKobo: number;
  ngnToUsdRate: number;
  expiresAt: Date;
  ssrfOptions?: SsrfCheckOptions;
}

export interface PreparedDepositResult {
  businessWallet: DiscoveredWallet;
  customerWallet: DiscoveredWallet;
  incomingPayment: IncomingPayment;
  quote: Quote;
  expectedAmount: AssetAmount;
  isCrossCurrency: boolean;
  conversionRateUsed: number | null;
}

export interface StartAuthInput {
  customerWallet: DiscoveredWallet;
  quote: Quote;
  callbackUrl: string;
  tokenEncryptionKey: string;
}

export interface StartAuthResult {
  redirectUrl: string;
  stateToken: string;
  authNonceHash: string;
  clientNonce: string;
  interactNonce: string;
  continueUri: string;
  continueAccessTokenEnc: string;
  grantEndpoint: string;
}

export interface CompleteAuthInput {
  customerWallet: DiscoveredWallet;
  quoteId: string;
  quoteExpiresAt: Date | null;
  holdExpiresAt: Date;
  interactRef: string;
  receivedHash?: string;
  clientNonce: string;
  interactNonce: string;
  continueUri: string;
  continueAccessTokenEnc: string;
  tokenEncryptionKey: string;
  bookingId: string;
  paymentId: string;
}

export interface CompleteAuthResult {
  outgoingPayment: OutgoingPayment;
  outgoingAccessTokenEnc: string;
}

export interface VerifyReceiptResult {
  verified: boolean;
  underpaid: boolean;
  overpaid: boolean;
  receivedAmount: AssetAmount;
  expectedAmount: AssetAmount;
  completed: boolean;
}

function mapAdapterError(
  error: unknown,
  fallbackCode: OpenPaymentsDomainError['code'],
): OpenPaymentsDomainError {
  const message = error instanceof Error ? error.message : 'Open Payments request failed';
  const lower = message.toLowerCase();
  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('econnreset')) {
    return { code: 'PROVIDER_TIMEOUT', message, retryable: true };
  }
  if (lower.includes('insufficient')) {
    return { code: 'INSUFFICIENT_FUNDS', message, retryable: false };
  }
  if (lower.includes('reject') || lower.includes('denied') || lower.includes('cancel')) {
    return { code: 'GRANT_REJECTED', message, retryable: false };
  }
  if (lower.includes('expired')) {
    return { code: 'GRANT_EXPIRED', message, retryable: false };
  }
  return { code: fallbackCode, message, retryable: false };
}

function toDiscoveredWallet(w: WalletAddress): DiscoveredWallet {
  return {
    id: w.id,
    ...(w.publicName ? { publicName: w.publicName } : {}),
    assetCode: w.assetCode,
    assetScale: w.assetScale,
    authServer: w.authServer,
    resourceServer: w.resourceServer,
  };
}

export async function discoverWalletAddress(
  adapter: OpenPaymentsAdapter,
  rawUrl: string,
  ssrfOptions: SsrfCheckOptions = {},
): Promise<Result<DiscoveredWallet>> {
  const safe = await assertSafeRemoteUrl(rawUrl, ssrfOptions);
  if (!safe.ok) return safe;

  try {
    const wallet = await adapter.getWalletAddress(safe.value);
    if (!wallet.id || !wallet.authServer || !wallet.resourceServer || !wallet.assetCode) {
      return err({
        code: 'WALLET_DISCOVERY_FAILED',
        message: 'Wallet address response is missing required Open Payments fields.',
        retryable: false,
      });
    }
    return ok(toDiscoveredWallet(wallet));
  } catch (error) {
    return err(mapAdapterError(error, 'WALLET_DISCOVERY_FAILED'));
  }
}

export async function testBusinessWalletConnection(
  adapter: OpenPaymentsAdapter,
  walletAddressUrl: string,
  ssrfOptions: SsrfCheckOptions = {},
): Promise<Result<{ wallet: DiscoveredWallet; grantVerified: boolean }>> {
  const discovered = await discoverWalletAddress(adapter, walletAddressUrl, ssrfOptions);
  if (!discovered.ok) return discovered;

  try {
    // Request a minimal read-only incoming-payment grant to verify client key & auth server signing
    const grant = await adapter.requestGrant(discovered.value.authServer, {
      access_token: {
        access: [
          {
            type: 'incoming-payment',
            actions: ['read'],
            identifier: discovered.value.id,
          },
        ],
      },
    });
    const grantVerified = !isPendingGrant(grant) && isFinalizedGrantWithAccessToken(grant);
    return ok({ wallet: discovered.value, grantVerified });
  } catch (error) {
    return err(mapAdapterError(error, 'GRANT_REQUEST_FAILED'));
  }
}

export async function prepareIncomingPaymentAndQuote(
  adapter: OpenPaymentsAdapter,
  input: PrepareDepositInput,
): Promise<Result<PreparedDepositResult>> {
  const businessRes = await discoverWalletAddress(
    adapter,
    input.businessWalletAddress,
    input.ssrfOptions,
  );
  if (!businessRes.ok) return businessRes;

  const customerRes = await discoverWalletAddress(
    adapter,
    input.customerWalletAddress,
    input.ssrfOptions,
  );
  if (!customerRes.ok) return customerRes;

  const conversion = convertKoboToWalletAsset({
    amountKobo: input.amountKobo,
    targetAssetCode: businessRes.value.assetCode,
    targetAssetScale: businessRes.value.assetScale,
    ngnToUsdRate: input.ngnToUsdRate,
  });
  if (!conversion.ok) return conversion;

  let incomingGrant: PendingGrant | Grant;
  try {
    incomingGrant = await adapter.requestGrant(businessRes.value.authServer, {
      access_token: {
        access: [
          {
            type: 'incoming-payment',
            actions: ['create', 'read', 'complete'],
            identifier: businessRes.value.id,
          },
        ],
      },
    });
  } catch (error) {
    return err(mapAdapterError(error, 'GRANT_REQUEST_FAILED'));
  }

  if (isPendingGrant(incomingGrant) || !isFinalizedGrantWithAccessToken(incomingGrant)) {
    return err({
      code: 'GRANT_REQUEST_FAILED',
      message: 'Business incoming-payment grant did not return an access token.',
      retryable: false,
    });
  }

  let incomingPayment: IncomingPayment;
  try {
    incomingPayment = await adapter.createIncomingPayment(
      businessRes.value.resourceServer,
      incomingGrant.access_token.value,
      {
        walletAddress: businessRes.value.id,
        incomingAmount: conversion.value.amount,
        expiresAt: input.expiresAt.toISOString(),
        metadata: {
          description: `Deposit for ${input.businessName} booking ${input.bookingId}`,
          bookingId: input.bookingId,
          businessId: input.businessId,
        },
      },
    );
  } catch (error) {
    return err(mapAdapterError(error, 'INCOMING_PAYMENT_FAILED'));
  }

  let quoteGrant: PendingGrant | Grant;
  try {
    quoteGrant = await adapter.requestGrant(customerRes.value.authServer, {
      access_token: {
        access: [
          {
            type: 'quote',
            actions: ['create', 'read'],
          },
        ],
      },
    });
  } catch (error) {
    return err(mapAdapterError(error, 'GRANT_REQUEST_FAILED'));
  }

  if (isPendingGrant(quoteGrant) || !isFinalizedGrantWithAccessToken(quoteGrant)) {
    return err({
      code: 'GRANT_REQUEST_FAILED',
      message: 'Customer quote grant did not return an access token.',
      retryable: false,
    });
  }

  let quote: Quote;
  try {
    quote = await adapter.createQuote(
      customerRes.value.resourceServer,
      quoteGrant.access_token.value,
      {
        walletAddress: customerRes.value.id,
        receiver: incomingPayment.id,
      },
    );
  } catch (error) {
    return err(mapAdapterError(error, 'QUOTE_FAILED'));
  }

  return ok({
    businessWallet: businessRes.value,
    customerWallet: customerRes.value,
    incomingPayment,
    quote,
    expectedAmount: conversion.value.amount,
    isCrossCurrency: conversion.value.isCrossCurrency,
    conversionRateUsed: conversion.value.conversionRateUsed,
  });
}

export async function startOutgoingPaymentAuthorization(
  adapter: OpenPaymentsAdapter,
  input: StartAuthInput,
): Promise<Result<StartAuthResult>> {
  const stateToken = generateOpaqueToken(24);
  const authNonceHash = sha256Hex(stateToken);
  const clientNonce = generateOpaqueToken(16);

  const callbackWithState = new URL(input.callbackUrl);
  callbackWithState.searchParams.set('state', stateToken);

  let grant: PendingGrant | Grant;
  try {
    grant = await adapter.requestGrant(input.customerWallet.authServer, {
      access_token: {
        access: [
          {
            type: 'outgoing-payment',
            actions: ['create', 'read'],
            identifier: input.customerWallet.id,
            limits: {
              debitAmount: input.quote.debitAmount,
            },
          },
        ],
      },
      interact: {
        start: ['redirect'],
        finish: {
          method: 'redirect',
          uri: callbackWithState.toString(),
          nonce: clientNonce,
        },
      },
    });
  } catch (error) {
    return err(mapAdapterError(error, 'GRANT_REQUEST_FAILED'));
  }

  if (!isPendingGrant(grant)) {
    return err({
      code: 'GRANT_REQUEST_FAILED',
      message: 'Wallet provider did not return an interactive authorization redirect.',
      retryable: false,
    });
  }

  return ok({
    redirectUrl: grant.interact.redirect,
    stateToken,
    authNonceHash,
    clientNonce,
    interactNonce: grant.interact.finish || clientNonce,
    continueUri: grant.continue.uri,
    continueAccessTokenEnc: encryptToken(
      grant.continue.access_token.value,
      input.tokenEncryptionKey,
    ),
    grantEndpoint: input.customerWallet.authServer,
  });
}

export async function completeAuthorizationAndCreateOutgoingPayment(
  adapter: OpenPaymentsAdapter,
  input: CompleteAuthInput,
): Promise<Result<CompleteAuthResult>> {
  const now = Date.now();
  if (input.holdExpiresAt.getTime() <= now) {
    return err({
      code: 'GRANT_EXPIRED',
      message: 'Your 15-minute booking hold has expired. Please select a new slot.',
      retryable: false,
    });
  }

  if (input.quoteExpiresAt && input.quoteExpiresAt.getTime() <= now) {
    return err({
      code: 'QUOTE_EXPIRED',
      message: 'Your payment quote has expired. Please request a fresh quote.',
      retryable: false,
    });
  }

  if (input.receivedHash) {
    const authServer = input.customerWallet.authServer;
    const altAuthServer = authServer.endsWith('/') ? authServer.slice(0, -1) : `${authServer}/`;
    const validHash =
      verifyGnapInteractionHash({
        clientNonce: input.clientNonce,
        interactNonce: input.interactNonce,
        interactRef: input.interactRef,
        grantEndpoint: authServer,
        receivedHash: input.receivedHash,
      }) ||
      verifyGnapInteractionHash({
        clientNonce: input.clientNonce,
        interactNonce: input.interactNonce,
        interactRef: input.interactRef,
        grantEndpoint: altAuthServer,
        receivedHash: input.receivedHash,
      });
    if (!validHash) {
      return err({
        code: 'INVALID_CALLBACK_STATE',
        message: 'Wallet authorization callback signature could not be verified.',
        retryable: false,
      });
    }
  }

  const continueToken = decryptToken(input.continueAccessTokenEnc, input.tokenEncryptionKey);

  let continuedGrant: Grant;
  try {
    continuedGrant = await adapter.continueGrant(input.continueUri, continueToken, {
      interact_ref: input.interactRef,
    });
  } catch (error) {
    return err(mapAdapterError(error, 'GRANT_REJECTED'));
  }

  if (!isFinalizedGrantWithAccessToken(continuedGrant)) {
    return err({
      code: 'GRANT_REJECTED',
      message: 'Wallet authorization did not produce an outgoing payment access token.',
      retryable: false,
    });
  }

  const outgoingToken = continuedGrant.access_token.value;

  let outgoingPayment: OutgoingPayment;
  try {
    outgoingPayment = await adapter.createOutgoingPayment(
      input.customerWallet.resourceServer,
      outgoingToken,
      {
        walletAddress: input.customerWallet.id,
        quoteId: input.quoteId,
        metadata: {
          bookingId: input.bookingId,
          paymentId: input.paymentId,
        },
      },
    );
  } catch (error) {
    return err(mapAdapterError(error, 'OUTGOING_PAYMENT_FAILED'));
  }

  return ok({
    outgoingPayment,
    outgoingAccessTokenEnc: encryptToken(outgoingToken, input.tokenEncryptionKey),
  });
}

export async function verifyIncomingPaymentReceipt(
  adapter: OpenPaymentsAdapter,
  input: {
    businessWallet: DiscoveredWallet;
    incomingPaymentId: string;
    expectedAmount: AssetAmount;
  },
): Promise<Result<VerifyReceiptResult>> {
  let grant: PendingGrant | Grant;
  try {
    grant = await adapter.requestGrant(input.businessWallet.authServer, {
      access_token: {
        access: [
          {
            type: 'incoming-payment',
            actions: ['read'],
            identifier: input.businessWallet.id,
          },
        ],
      },
    });
  } catch (error) {
    return err(mapAdapterError(error, 'VERIFICATION_PENDING'));
  }

  if (isPendingGrant(grant) || !isFinalizedGrantWithAccessToken(grant)) {
    return err({
      code: 'VERIFICATION_PENDING',
      message: 'Could not obtain recipient read grant for incoming payment verification.',
      retryable: true,
    });
  }

  let incoming: IncomingPayment;
  try {
    incoming = await adapter.getIncomingPayment(input.incomingPaymentId, grant.access_token.value);
  } catch (error) {
    return err(mapAdapterError(error, 'VERIFICATION_PENDING'));
  }

  const received = incoming.receivedAmount;
  if (received.assetCode.toUpperCase() !== input.expectedAmount.assetCode.toUpperCase()) {
    return err({
      code: 'UNSUPPORTED_ASSET',
      message: `Received asset ${received.assetCode} does not match expected ${input.expectedAmount.assetCode}.`,
      retryable: false,
    });
  }

  const cmp = compareMinorUnits(received.value, input.expectedAmount.value);
  const satisfied = cmp >= 0;
  const underpaid = !satisfied && BigInt(received.value) > 0n;
  const overpaid = cmp > 0;

  return ok({
    verified: satisfied,
    underpaid,
    overpaid,
    receivedAmount: received,
    expectedAmount: input.expectedAmount,
    completed: incoming.completed,
  });
}
