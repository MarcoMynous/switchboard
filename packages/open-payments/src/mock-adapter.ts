import type {
  Grant,
  IncomingPayment,
  OpenPaymentsAdapter,
  OutgoingPayment,
  PendingGrant,
  Quote,
  WalletAddress,
} from './adapter.ts';
import type { AssetAmount } from './money.ts';

export interface MockOpenPaymentsBehavior {
  failDiscoveryFor?: Set<string>;
  failQuote?: boolean;
  expiredQuote?: boolean;
  rejectGrant?: boolean;
  timeoutOutgoing?: boolean;
  timeoutVerification?: boolean;
  insufficientFunds?: boolean;
  /** Override received amount on incoming payment (e.g. '50' for underpayment, '200' for overpayment, '0' for pending). */
  overrideReceivedValue?: string;
}

export function createMockOpenPaymentsAdapter(
  initialBehavior: MockOpenPaymentsBehavior = {},
): OpenPaymentsAdapter & {
  behavior: MockOpenPaymentsBehavior;
  wallets: Map<string, WalletAddress>;
  incomingPayments: Map<string, IncomingPayment>;
  quotes: Map<string, Quote>;
  outgoingPayments: Map<string, OutgoingPayment>;
} {
  const behavior: MockOpenPaymentsBehavior = { ...initialBehavior };
  const wallets = new Map<string, WalletAddress>();
  const incomingPayments = new Map<string, IncomingPayment>();
  const quotes = new Map<string, Quote>();
  const outgoingPayments = new Map<string, OutgoingPayment>();

  let seq = 1;
  const nextId = (prefix: string) => `${prefix}-${seq++}`;

  const defaultBizWallet: WalletAddress = {
    id: 'https://ilp.interledger-test.dev/fade-republic',
    publicName: 'Fade Republic Ota',
    assetCode: 'USD',
    assetScale: 2,
    authServer: 'https://auth.interledger-test.dev',
    resourceServer: 'https://ilp.interledger-test.dev',
  };
  const defaultCustWallet: WalletAddress = {
    id: 'https://ilp.interledger-test.dev/customer-alice',
    publicName: 'Alice Test Wallet',
    assetCode: 'USD',
    assetScale: 2,
    authServer: 'https://auth.interledger-test.dev',
    resourceServer: 'https://ilp.interledger-test.dev',
  };
  wallets.set(defaultBizWallet.id, defaultBizWallet);
  wallets.set(defaultCustWallet.id, defaultCustWallet);

  const adapter: OpenPaymentsAdapter = {
    async getWalletAddress(url) {
      if (behavior.failDiscoveryFor?.has(url)) {
        throw new Error('Wallet address not found');
      }
      const existing = wallets.get(url);
      if (existing) return existing;
      throw new Error(`Unknown mock wallet address: ${url}`);
    },

    async requestGrant(_authServerUrl, body) {
      if (body.interact) {
        const continueToken = nextId('cont-tok');
        const interactNonce = nextId('server-nonce');
        const pending: PendingGrant = {
          interact: {
            redirect: `https://auth.interledger-test.dev/interact/${nextId('int')}`,
            finish: interactNonce,
          },
          continue: {
            uri: `https://auth.interledger-test.dev/continue/${nextId('cont')}`,
            access_token: { value: continueToken },
            wait: 1,
          },
        };
        return pending;
      }

      const grant: Grant = {
        access_token: {
          value: nextId('tok'),
          manage: 'https://auth.interledger-test.dev/token/1',
          access: body.access_token?.access ?? [],
        },
        continue: {
          uri: `https://auth.interledger-test.dev/continue/${nextId('cont')}`,
          access_token: { value: nextId('cont-tok') },
        },
      };
      return grant;
    },

    async continueGrant(_continueUri, _accessToken, _body) {
      if (behavior.rejectGrant) {
        throw new Error('Grant rejected by customer');
      }
      const grant: Grant = {
        access_token: {
          value: nextId('out-tok'),
          manage: 'https://auth.interledger-test.dev/token/2',
          access: [],
        },
        continue: {
          uri: 'https://auth.interledger-test.dev/continue/done',
          access_token: { value: nextId('cont-done') },
        },
      };
      return grant;
    },

    async cancelGrant() {
      return;
    },

    async createIncomingPayment(resourceServerUrl, _accessToken, args) {
      const id = `${resourceServerUrl}/incoming-payments/${nextId('inc')}`;
      const incoming: IncomingPayment = {
        id,
        walletAddress: args.walletAddress,
        completed: false,
        incomingAmount: args.incomingAmount,
        receivedAmount: {
          value: '0',
          assetCode: args.incomingAmount.assetCode,
          assetScale: args.incomingAmount.assetScale,
        },
        expiresAt: args.expiresAt ?? new Date(Date.now() + 900_000).toISOString(),
        createdAt: new Date().toISOString(),
        metadata: args.metadata,
      };
      incomingPayments.set(id, incoming);
      return incoming;
    },

    async getIncomingPayment(url) {
      if (behavior.timeoutVerification) {
        throw new Error('Request timeout while querying incoming payment');
      }
      const inc = incomingPayments.get(url);
      if (!inc) throw new Error(`Incoming payment not found: ${url}`);
      return inc;
    },

    async createQuote(resourceServerUrl, _accessToken, args) {
      if (behavior.failQuote) {
        throw new Error('Provider unable to quote this transfer');
      }
      const inc = incomingPayments.get(args.receiver);
      if (!inc || !inc.incomingAmount) {
        throw new Error('Incoming payment not found for quote');
      }
      const id = `${resourceServerUrl}/quotes/${nextId('qt')}`;
      const debitValue = (BigInt(inc.incomingAmount.value) + 2n).toString();
      const expiresAt = behavior.expiredQuote
        ? new Date(Date.now() - 60_000).toISOString()
        : new Date(Date.now() + 300_000).toISOString();
      const quote: Quote = {
        id,
        walletAddress: args.walletAddress,
        receiver: args.receiver,
        receiveAmount: inc.incomingAmount,
        debitAmount: {
          value: debitValue,
          assetCode: inc.incomingAmount.assetCode,
          assetScale: inc.incomingAmount.assetScale,
        },
        method: 'ilp',
        createdAt: new Date().toISOString(),
        expiresAt,
      };
      quotes.set(id, quote);
      return quote;
    },

    async createOutgoingPayment(resourceServerUrl, _accessToken, args) {
      if (behavior.timeoutOutgoing) {
        throw new Error('Provider timeout creating outgoing payment');
      }
      if (behavior.insufficientFunds) {
        throw new Error('Insufficient funds in sender wallet');
      }
      const quote = quotes.get(args.quoteId);
      if (!quote) throw new Error(`Quote not found: ${args.quoteId}`);

      const inc = incomingPayments.get(quote.receiver);
      if (inc) {
        const settledValue = behavior.overrideReceivedValue ?? quote.receiveAmount.value;
        const settledAmount: AssetAmount = {
          value: settledValue,
          assetCode: quote.receiveAmount.assetCode,
          assetScale: quote.receiveAmount.assetScale,
        };
        const fullyPaid = BigInt(settledValue) >= BigInt(quote.receiveAmount.value);
        incomingPayments.set(inc.id, {
          ...inc,
          receivedAmount: settledAmount,
          completed: fullyPaid,
        });
      }

      const out: OutgoingPayment = {
        id: `${resourceServerUrl}/outgoing-payments/${nextId('out')}`,
        walletAddress: args.walletAddress,
        quoteId: args.quoteId,
        receiver: quote.receiver,
        debitAmount: quote.debitAmount,
        receiveAmount: quote.receiveAmount,
        sentAmount: quote.receiveAmount,
        failed: false,
        createdAt: new Date().toISOString(),
        metadata: args.metadata,
      };
      outgoingPayments.set(out.id, out);
      return out;
    },

    async getOutgoingPayment(url) {
      const out = outgoingPayments.get(url);
      if (!out) throw new Error(`Outgoing payment not found: ${url}`);
      return out;
    },
  };

  return {
    ...adapter,
    behavior,
    wallets,
    incomingPayments,
    quotes,
    outgoingPayments,
  };
}
