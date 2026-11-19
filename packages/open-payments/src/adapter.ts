import { createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  type AuthenticatedClient,
  createAuthenticatedClient,
  type Grant,
  type GrantContinuationRequest,
  type GrantRequest,
  type IncomingPayment,
  isFinalizedGrantWithAccessToken,
  isPendingGrant,
  type OutgoingPayment,
  type PendingGrant,
  type Quote,
  type WalletAddress,
} from '@interledger/open-payments';
import type { AssetAmount } from './money.ts';

export type { Grant, IncomingPayment, OutgoingPayment, PendingGrant, Quote, WalletAddress };

export interface OpenPaymentsAdapter {
  getWalletAddress(url: string): Promise<WalletAddress>;
  requestGrant(
    authServerUrl: string,
    body: Omit<GrantRequest, 'client'>,
  ): Promise<PendingGrant | Grant>;
  continueGrant(
    continueUri: string,
    accessToken: string,
    body?: GrantContinuationRequest,
  ): Promise<Grant>;
  cancelGrant(continueUri: string, accessToken: string): Promise<void>;
  createIncomingPayment(
    resourceServerUrl: string,
    accessToken: string,
    args: {
      walletAddress: string;
      incomingAmount: AssetAmount;
      expiresAt?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<IncomingPayment>;
  getIncomingPayment(url: string, accessToken: string): Promise<IncomingPayment>;
  createQuote(
    resourceServerUrl: string,
    accessToken: string,
    args: {
      walletAddress: string;
      receiver: string;
    },
  ): Promise<Quote>;
  createOutgoingPayment(
    resourceServerUrl: string,
    accessToken: string,
    args: {
      walletAddress: string;
      quoteId: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<OutgoingPayment>;
  getOutgoingPayment(url: string, accessToken: string): Promise<OutgoingPayment>;
}

export interface RealClientConfig {
  walletAddressUrl: string;
  privateKeyPem?: string;
  privateKeyPath?: string;
  keyId: string;
  requestTimeoutMs?: number;
  useHttp?: boolean;
}

function loadPrivateKey(config: RealClientConfig) {
  let rawPem = config.privateKeyPem?.trim();
  if (!rawPem && config.privateKeyPath) {
    rawPem = readFileSync(config.privateKeyPath, 'utf8').trim();
  }
  if (!rawPem) {
    throw new Error('Either privateKeyPem or privateKeyPath must be provided');
  }
  // Strip accidental surrounding quotes from Vercel/shell env var entry
  if (
    (rawPem.startsWith('"') && rawPem.endsWith('"')) ||
    (rawPem.startsWith("'") && rawPem.endsWith("'"))
  ) {
    rawPem = rawPem.slice(1, -1).trim();
  }
  // Normalize Windows CRLF and escaped \n in single-line env vars, or decode base64-encoded PEM
  rawPem = rawPem.replace(/\r\n/g, '\n');
  if (rawPem.includes('\\n')) {
    rawPem = rawPem.replace(/\\n/g, '\n');
  } else if (!rawPem.includes('-----BEGIN')) {
    rawPem = Buffer.from(rawPem, 'base64').toString('utf8');
  }
  return createPrivateKey(rawPem);
}

export async function createRealOpenPaymentsAdapter(
  config: RealClientConfig,
): Promise<OpenPaymentsAdapter> {
  const normalizedWalletUrl = config.walletAddressUrl.trim().startsWith('$')
    ? `https://${config.walletAddressUrl.trim().slice(1)}`
    : config.walletAddressUrl.trim();

  const client: AuthenticatedClient = await createAuthenticatedClient({
    walletAddressUrl: normalizedWalletUrl,
    privateKey: loadPrivateKey(config),
    keyId: config.keyId.trim(),
    requestTimeoutMs: config.requestTimeoutMs ?? 15_000,
    useHttp: config.useHttp ?? false,
  });

  return {
    getWalletAddress: (url) => client.walletAddress.get({ url }),
    requestGrant: (authServerUrl, body) => client.grant.request({ url: authServerUrl }, body),
    continueGrant: async (continueUri, accessToken, body) => {
      const res = await client.grant.continue({ url: continueUri, accessToken }, body);
      if (!isFinalizedGrantWithAccessToken(res)) {
        throw new Error('Grant continuation did not return a finalized access token');
      }
      return res;
    },
    cancelGrant: (continueUri, accessToken) =>
      client.grant.cancel({ url: continueUri, accessToken }),
    createIncomingPayment: (resourceServerUrl, accessToken, args) =>
      client.incomingPayment.create({ url: resourceServerUrl, accessToken }, args),
    getIncomingPayment: (url, accessToken) => client.incomingPayment.get({ url, accessToken }),
    createQuote: (resourceServerUrl, accessToken, args) =>
      client.quote.create(
        { url: resourceServerUrl, accessToken },
        {
          walletAddress: args.walletAddress,
          receiver: args.receiver,
          method: 'ilp',
        },
      ),
    createOutgoingPayment: (resourceServerUrl, accessToken, args) =>
      client.outgoingPayment.create({ url: resourceServerUrl, accessToken }, args),
    getOutgoingPayment: (url, accessToken) => client.outgoingPayment.get({ url, accessToken }),
  };
}

export { isFinalizedGrantWithAccessToken, isPendingGrant };
