import { getPublicCatalog } from '@switchboard/booking';
import {
  auditLog,
  bookings,
  type Db,
  openPaymentsAttempts,
  payments,
  services,
} from '@switchboard/db';
import {
  completeAuthorizationAndCreateOutgoingPayment,
  type OpenPaymentsAdapter,
  prepareIncomingPaymentAndQuote,
  sha256Hex,
  startOutgoingPaymentAuthorization,
  testBusinessWalletConnection,
} from '@switchboard/open-payments';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Logger } from '../logger.ts';
import { verifyAndSettleInterledgerPayment } from '../payments/verify-interledger.ts';

export interface InterledgerRoutesDeps {
  db: Db;
  logger: Logger;
  publicAppUrl: string;
  redirectUri?: string;
  ngnToUsdRate: number;
  tokenEncryptionKey: string;
  getAdapter: () => Promise<OpenPaymentsAdapter | null>;
  enqueueVerify?: (paymentId: string) => Promise<void>;
}

function splitNonces(stored: string | null | undefined): {
  clientNonce: string;
  interactNonce: string;
} {
  if (!stored) return { clientNonce: '', interactNonce: '' };
  const idx = stored.indexOf(':');
  if (idx === -1) return { clientNonce: stored, interactNonce: stored };
  return {
    clientNonce: stored.slice(0, idx),
    interactNonce: stored.slice(idx + 1),
  };
}

const prepareSchema = z.object({
  bookingId: z.uuid(),
  customerWalletAddress: z.string().trim().min(3).max(512),
  idempotencyKey: z.string().min(8).max(128),
});

const authorizeSchema = z.object({
  paymentId: z.uuid(),
});

const callbackSchema = z.object({
  paymentId: z.uuid(),
  state: z.string().min(10).max(256),
  interact_ref: z.string().min(1).max(512),
  hash: z.string().max(512).optional(),
});

const testConnectionSchema = z.object({
  walletAddress: z.string().trim().min(3).max(512),
});

function resolveDepositKobo(service: {
  priceKobo: number;
  depositType: string;
  depositValue: number;
}): number {
  if (service.depositType === 'none') return 0;
  if (service.depositType === 'full') return service.priceKobo;
  if (service.depositType === 'percent') {
    const pct = Math.max(0, Math.min(100, service.depositValue));
    return Math.round((service.priceKobo * pct) / 100);
  }
  return Math.max(0, service.depositValue);
}

export function interledgerPublicRoutes(deps: InterledgerRoutesDeps) {
  const app = new Hono();

  app.post('/:slug/payments/interledger/prepare', async (c) => {
    const body = prepareSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: { code: 'BAD_REQUEST', issues: body.error.issues } }, 400);
    }

    const catalog = await getPublicCatalog(deps.db, c.req.param('slug'));
    if (!catalog) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Business not found' } }, 404);
    }

    const business = await deps.db.query.businesses.findFirst({
      where: (b, { eq: eqFn }) => eqFn(b.id, catalog.business.id),
    });
    if (!business || !business.interledgerEnabled || !business.interledgerWalletAddress) {
      return c.json(
        {
          error: {
            code: 'INTERLEDGER_UNAVAILABLE',
            message: 'Interledger Wallet payments are not enabled for this business.',
          },
        },
        422,
      );
    }

    // Production gate: never allow live production payments unless explicitly approved
    if (
      business.interledgerEnvironment === 'production' &&
      process.env.OPEN_PAYMENTS_PRODUCTION_APPROVED !== 'true'
    ) {
      return c.json(
        {
          error: {
            code: 'PRODUCTION_NOT_APPROVED',
            message: 'Production Interledger payments are not yet activated.',
          },
        },
        422,
      );
    }

    // Idempotent replay check
    const existingPayment = await deps.db.query.payments.findFirst({
      where: and(
        eq(payments.businessId, business.id),
        eq(payments.idempotencyKey, body.data.idempotencyKey),
      ),
    });
    if (existingPayment) {
      const existingAttempt = await deps.db.query.openPaymentsAttempts.findFirst({
        where: eq(openPaymentsAttempts.paymentId, existingPayment.id),
      });
      if (existingAttempt) {
        return c.json({
          replayed: true,
          paymentId: existingPayment.id,
          reference: existingPayment.providerReference,
          incomingPaymentId: existingAttempt.incomingPaymentId,
          isSimulated: existingPayment.isSimulated,
          expectedAmount: {
            value: existingPayment.providerExpectedAmount,
            assetCode: existingPayment.assetCode,
            assetScale: existingPayment.assetScale,
          },
          quote: {
            id: existingAttempt.quoteId,
            debitAmount: {
              value: existingAttempt.quoteDebitAmount,
              assetCode: existingAttempt.quoteDebitAssetCode,
              assetScale: existingAttempt.quoteDebitAssetScale,
            },
            receiveAmount: {
              value: existingAttempt.quoteReceiveAmount,
              assetCode: existingPayment.assetCode,
              assetScale: existingPayment.assetScale,
            },
            expiresAt: existingAttempt.quoteExpiresAt?.toISOString() ?? null,
          },
        });
      }
    }

    const booking = await deps.db.query.bookings.findFirst({
      where: and(eq(bookings.id, body.data.bookingId), eq(bookings.businessId, business.id)),
    });
    if (!booking) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);
    }
    if (
      booking.status !== 'held' ||
      !booking.holdExpiresAt ||
      booking.holdExpiresAt <= new Date()
    ) {
      return c.json(
        {
          error: {
            code: 'HOLD_EXPIRED',
            message: 'This appointment hold is no longer active.',
          },
        },
        409,
      );
    }

    // Prevent duplicate collection across Kora and Interledger for the same booking
    const activeOtherPayment = await deps.db.query.payments.findFirst({
      where: and(
        eq(payments.bookingId, booking.id),
        inArray(payments.status, ['succeeded', 'pending_verification']),
      ),
    });
    if (activeOtherPayment) {
      return c.json(
        {
          error: {
            code: 'DUPLICATE_PAYMENT_BLOCKED',
            message: 'A payment for this booking is already verified or awaiting verification.',
          },
        },
        409,
      );
    }

    const service = await deps.db.query.services.findFirst({
      where: and(eq(services.id, booking.serviceId), eq(services.businessId, business.id)),
    });
    if (!service) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Service not found' } }, 404);
    }

    const depositKobo = resolveDepositKobo(service);
    if (depositKobo <= 0) {
      return c.json(
        { error: { code: 'NO_DEPOSIT_REQUIRED', message: 'This service requires no deposit.' } },
        422,
      );
    }

    const adapter = await deps.getAdapter();
    if (!adapter) {
      return c.json(
        {
          error: {
            code: 'INTERLEDGER_UNAVAILABLE',
            message: 'Open Payments client is not configured on the server.',
          },
        },
        503,
      );
    }

    const prepared = await prepareIncomingPaymentAndQuote(adapter, {
      bookingId: booking.id,
      businessId: business.id,
      businessName: business.name,
      businessWalletAddress: business.interledgerWalletAddress,
      customerWalletAddress: body.data.customerWalletAddress,
      amountKobo: depositKobo,
      ngnToUsdRate: deps.ngnToUsdRate,
      expiresAt: booking.holdExpiresAt,
    });

    if (!prepared.ok) {
      return c.json({ error: prepared.error }, 422);
    }

    const providerRef = `sb_ilp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const isSimulated = business.interledgerEnvironment !== 'production';

    const created = await deps.db.transaction(async (tx) => {
      const [payRow] = await tx
        .insert(payments)
        .values({
          businessId: business.id,
          bookingId: booking.id,
          provider: 'interledger',
          providerEnvironment: business.interledgerEnvironment,
          providerReference: providerRef,
          kind: 'deposit',
          amountKobo: depositKobo,
          assetCode: prepared.value.expectedAmount.assetCode,
          assetScale: prepared.value.expectedAmount.assetScale,
          providerExpectedAmount: prepared.value.expectedAmount.value,
          isSimulated,
          status: 'pending',
          expiresAt: booking.holdExpiresAt,
          idempotencyKey: body.data.idempotencyKey,
        })
        .returning();

      if (!payRow) throw new Error('Failed to insert payment');

      await tx.insert(openPaymentsAttempts).values({
        paymentId: payRow.id,
        businessId: business.id,
        bookingId: booking.id,
        senderWalletAddress: prepared.value.customerWallet.id,
        recipientWalletAddress: prepared.value.businessWallet.id,
        incomingPaymentId: prepared.value.incomingPayment.id,
        quoteId: prepared.value.quote.id,
        quoteDebitAmount: prepared.value.quote.debitAmount.value,
        quoteDebitAssetCode: prepared.value.quote.debitAmount.assetCode,
        quoteDebitAssetScale: prepared.value.quote.debitAmount.assetScale,
        quoteReceiveAmount: prepared.value.quote.receiveAmount.value,
        quoteExpiresAt: prepared.value.quote.expiresAt
          ? new Date(prepared.value.quote.expiresAt)
          : null,
        grantState: 'quoted',
        expiresAt: booking.holdExpiresAt,
      });

      await tx.insert(auditLog).values({
        businessId: business.id,
        actor: 'customer',
        action: 'payment.interledger.prepared',
        entity: 'payment',
        entityId: payRow.id,
        after: {
          bookingId: booking.id,
          incomingPaymentId: prepared.value.incomingPayment.id,
          quoteId: prepared.value.quote.id,
          isSimulated,
        },
      });

      return payRow;
    });

    return c.json(
      {
        replayed: false,
        paymentId: created.id,
        reference: created.providerReference,
        incomingPaymentId: prepared.value.incomingPayment.id,
        isSimulated,
        amountKobo: depositKobo,
        expectedAmount: prepared.value.expectedAmount,
        isCrossCurrency: prepared.value.isCrossCurrency,
        conversionRateUsed: prepared.value.conversionRateUsed,
        quote: {
          id: prepared.value.quote.id,
          debitAmount: prepared.value.quote.debitAmount,
          receiveAmount: prepared.value.quote.receiveAmount,
          expiresAt: prepared.value.quote.expiresAt ?? null,
        },
      },
      201,
    );
  });

  app.post('/:slug/payments/interledger/authorize', async (c) => {
    const body = authorizeSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: { code: 'BAD_REQUEST', issues: body.error.issues } }, 400);
    }

    const slug = c.req.param('slug');
    const catalog = await getPublicCatalog(deps.db, slug);
    if (!catalog) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Business not found' } }, 404);
    }

    const attempt = await deps.db.query.openPaymentsAttempts.findFirst({
      where: and(
        eq(openPaymentsAttempts.paymentId, body.data.paymentId),
        eq(openPaymentsAttempts.businessId, catalog.business.id),
      ),
    });
    if (!attempt || !attempt.quoteId || !attempt.quoteDebitAmount || !attempt.quoteDebitAssetCode) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Payment quote not found' } }, 404);
    }

    const booking = await deps.db.query.bookings.findFirst({
      where: eq(bookings.id, attempt.bookingId),
    });
    if (
      !booking ||
      booking.status !== 'held' ||
      !booking.holdExpiresAt ||
      booking.holdExpiresAt <= new Date()
    ) {
      return c.json({ error: { code: 'HOLD_EXPIRED', message: 'Booking hold expired' } }, 409);
    }
    if (attempt.quoteExpiresAt && attempt.quoteExpiresAt <= new Date()) {
      return c.json(
        { error: { code: 'QUOTE_EXPIRED', message: 'Quote expired; request a new quote' } },
        409,
      );
    }

    const adapter = await deps.getAdapter();
    if (!adapter) {
      return c.json(
        { error: { code: 'INTERLEDGER_UNAVAILABLE', message: 'Adapter unavailable' } },
        503,
      );
    }

    const rawCustWallet = await adapter.getWalletAddress(attempt.senderWalletAddress);
    const baseCallbackUrl =
      deps.redirectUri?.trim() ||
      `${deps.publicAppUrl.replace(/\/+$/, '')}/api/payments/interledger/callback`;
    const callbackWithPayment = new URL(baseCallbackUrl);
    callbackWithPayment.searchParams.set('paymentId', attempt.paymentId);
    const callbackUrl = callbackWithPayment.toString();

    const authRes = await startOutgoingPaymentAuthorization(adapter, {
      customerWallet: {
        id: rawCustWallet.id,
        assetCode: rawCustWallet.assetCode,
        assetScale: rawCustWallet.assetScale,
        authServer: rawCustWallet.authServer,
        resourceServer: rawCustWallet.resourceServer,
      },
      quote: {
        id: attempt.quoteId,
        walletAddress: rawCustWallet.id,
        receiver: attempt.incomingPaymentId ?? '',
        debitAmount: {
          value: attempt.quoteDebitAmount,
          assetCode: attempt.quoteDebitAssetCode,
          assetScale: attempt.quoteDebitAssetScale ?? 2,
        },
        receiveAmount: {
          value: attempt.quoteReceiveAmount ?? '0',
          assetCode: attempt.quoteDebitAssetCode,
          assetScale: attempt.quoteDebitAssetScale ?? 2,
        },
        method: 'ilp',
        createdAt: new Date().toISOString(),
      },
      callbackUrl,
      tokenEncryptionKey: deps.tokenEncryptionKey,
    });

    if (!authRes.ok) {
      return c.json({ error: authRes.error }, 422);
    }

    await deps.db
      .update(openPaymentsAttempts)
      .set({
        grantState: 'awaiting_authorization',
        authNonceHash: authRes.value.authNonceHash,
        interactNonce: `${authRes.value.clientNonce}:${authRes.value.interactNonce}`,
        continueUri: authRes.value.continueUri,
        continueAccessTokenEnc: authRes.value.continueAccessTokenEnc,
        updatedAt: new Date(),
      })
      .where(eq(openPaymentsAttempts.id, attempt.id));

    return c.json({ redirectUrl: authRes.value.redirectUrl });
  });

  app.post('/:slug/payments/interledger/callback', async (c) => {
    const body = callbackSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: { code: 'BAD_REQUEST', issues: body.error.issues } }, 400);
    }

    const catalog = await getPublicCatalog(deps.db, c.req.param('slug'));
    if (!catalog) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Business not found' } }, 404);
    }

    const attempt = await deps.db.query.openPaymentsAttempts.findFirst({
      where: and(
        eq(openPaymentsAttempts.paymentId, body.data.paymentId),
        eq(openPaymentsAttempts.businessId, catalog.business.id),
      ),
    });
    if (!attempt) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Payment attempt not found' } }, 404);
    }

    // Prevent callback replay
    if (attempt.grantState === 'outgoing_created' || attempt.grantState === 'verified') {
      const payment = await deps.db.query.payments.findFirst({
        where: eq(payments.id, attempt.paymentId),
      });
      return c.json({
        replayed: true,
        paymentId: attempt.paymentId,
        paymentStatus: payment?.status ?? 'pending_verification',
        grantState: attempt.grantState,
      });
    }

    const incomingHash = sha256Hex(body.data.state);
    if (
      attempt.grantState !== 'awaiting_authorization' ||
      !attempt.authNonceHash ||
      attempt.authNonceHash !== incomingHash ||
      !attempt.continueUri ||
      !attempt.continueAccessTokenEnc ||
      !attempt.quoteId
    ) {
      return c.json(
        {
          error: {
            code: 'INVALID_CALLBACK_STATE',
            message: 'Authorization callback state is invalid or already consumed.',
          },
        },
        409,
      );
    }

    const booking = await deps.db.query.bookings.findFirst({
      where: eq(bookings.id, attempt.bookingId),
    });
    if (!booking || !booking.holdExpiresAt) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);
    }

    const adapter = await deps.getAdapter();
    if (!adapter) {
      return c.json(
        { error: { code: 'INTERLEDGER_UNAVAILABLE', message: 'Adapter unavailable' } },
        503,
      );
    }

    const rawCustWallet = await adapter.getWalletAddress(attempt.senderWalletAddress);
    const { clientNonce, interactNonce } = splitNonces(attempt.interactNonce);

    const completed = await completeAuthorizationAndCreateOutgoingPayment(adapter, {
      customerWallet: {
        id: rawCustWallet.id,
        assetCode: rawCustWallet.assetCode,
        assetScale: rawCustWallet.assetScale,
        authServer: rawCustWallet.authServer,
        resourceServer: rawCustWallet.resourceServer,
      },
      quoteId: attempt.quoteId,
      quoteExpiresAt: attempt.quoteExpiresAt,
      holdExpiresAt: booking.holdExpiresAt,
      interactRef: body.data.interact_ref,
      ...(body.data.hash ? { receivedHash: body.data.hash } : {}),
      clientNonce,
      interactNonce,
      continueUri: attempt.continueUri,
      continueAccessTokenEnc: attempt.continueAccessTokenEnc,
      tokenEncryptionKey: deps.tokenEncryptionKey,
      bookingId: booking.id,
      paymentId: attempt.paymentId,
    });

    if (!completed.ok) {
      await deps.db
        .update(openPaymentsAttempts)
        .set({
          grantState: 'failed',
          authNonceHash: null,
          lastErrorCode: completed.error.code,
          lastErrorMessage: completed.error.message,
          updatedAt: new Date(),
        })
        .where(eq(openPaymentsAttempts.id, attempt.id));
      return c.json({ error: completed.error }, 422);
    }

    // Mark outgoing_created + pending_verification; consume authNonceHash so replay is impossible
    await deps.db.transaction(async (tx) => {
      await tx
        .update(openPaymentsAttempts)
        .set({
          grantState: 'outgoing_created',
          authNonceHash: null,
          outgoingPaymentId: completed.value.outgoingPayment.id,
          outgoingAccessTokenEnc: completed.value.outgoingAccessTokenEnc,
          updatedAt: new Date(),
        })
        .where(eq(openPaymentsAttempts.id, attempt.id));

      await tx
        .update(payments)
        .set({ status: 'pending_verification', updatedAt: new Date() })
        .where(eq(payments.id, attempt.paymentId));
    });

    // Trigger durable verification in Inngest + run immediate check
    if (deps.enqueueVerify) {
      await deps.enqueueVerify(attempt.paymentId).catch((err) => {
        deps.logger.warn(
          { err, paymentId: attempt.paymentId },
          'interledger: failed to enqueue verify',
        );
      });
    }

    const verification = await verifyAndSettleInterledgerPayment({
      db: deps.db,
      adapter,
      logger: deps.logger,
      paymentId: attempt.paymentId,
    });

    return c.json({
      paymentId: attempt.paymentId,
      outgoingPaymentId: completed.value.outgoingPayment.id,
      verification,
    });
  });

  app.get('/:slug/payments/interledger/:paymentId/status', async (c) => {
    const catalog = await getPublicCatalog(deps.db, c.req.param('slug'));
    if (!catalog) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Business not found' } }, 404);
    }
    const paymentId = c.req.param('paymentId');
    const payment = await deps.db.query.payments.findFirst({
      where: and(eq(payments.id, paymentId), eq(payments.businessId, catalog.business.id)),
    });
    if (!payment) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
    }
    const attempt = await deps.db.query.openPaymentsAttempts.findFirst({
      where: eq(openPaymentsAttempts.paymentId, payment.id),
    });
    const booking = payment.bookingId
      ? await deps.db.query.bookings.findFirst({ where: eq(bookings.id, payment.bookingId) })
      : null;

    return c.json({
      paymentId: payment.id,
      reference: payment.providerReference,
      paymentStatus: payment.status,
      bookingStatus: booking?.status ?? null,
      grantState: attempt?.grantState ?? null,
      isSimulated: payment.isSimulated,
      assetCode: payment.assetCode,
      assetScale: payment.assetScale,
      expectedAmount: payment.providerExpectedAmount,
      receivedAmount: payment.providerReceivedAmount,
      lastErrorCode: attempt?.lastErrorCode ?? null,
      lastErrorMessage: attempt?.lastErrorMessage ?? null,
      verifiedAt: payment.verifiedAt?.toISOString() ?? null,
    });
  });

  return app;
}

export function interledgerIntegrationRoutes(deps: {
  getAdapter: () => Promise<OpenPaymentsAdapter | null>;
}) {
  const app = new Hono();

  app.post('/test-connection', async (c) => {
    const body = testConnectionSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: { code: 'BAD_REQUEST', issues: body.error.issues } }, 400);
    }

    const adapter = await deps.getAdapter();
    if (!adapter) {
      return c.json(
        {
          connected: false,
          status: 'unavailable',
          message: 'Open Payments server credentials are not configured.',
        },
        200,
      );
    }

    const res = await testBusinessWalletConnection(adapter, body.data.walletAddress);
    if (!res.ok) {
      return c.json(
        {
          connected: false,
          status: 'unavailable',
          error: res.error,
        },
        200,
      );
    }

    return c.json({
      connected: res.value.grantVerified,
      status: res.value.grantVerified ? 'test_mode' : 'incomplete',
      wallet: res.value.wallet,
    });
  });

  return app;
}

/**
 * Browser GET callback endpoint for Open Payments GNAP redirect (`OPEN_PAYMENTS_REDIRECT_URI`).
 * Validates single-use state + GNAP hash server-side, continues grant, creates outgoing payment,
 * independently verifies recipient incoming payment, and redirects back to `/b/[slug]`.
 */
export function interledgerCallbackRoutes(deps: InterledgerRoutesDeps) {
  const app = new Hono();

  app.get('/callback', async (c) => {
    const paymentId = c.req.query('paymentId')?.trim() ?? '';
    const state = c.req.query('state')?.trim() ?? '';
    const interactRef = c.req.query('interact_ref')?.trim() ?? '';
    const hash = c.req.query('hash')?.trim() || undefined;
    const result = c.req.query('result')?.trim() ?? '';
    const appBase = deps.publicAppUrl.replace(/\/+$/, '');

    if (!paymentId) {
      return c.redirect(`${appBase}/?ilp_error=missing_payment`, 302);
    }

    const attempt = await deps.db.query.openPaymentsAttempts.findFirst({
      where: eq(openPaymentsAttempts.paymentId, paymentId),
    });
    if (!attempt) {
      return c.redirect(`${appBase}/?ilp_error=attempt_not_found`, 302);
    }

    const business = await deps.db.query.businesses.findFirst({
      where: (b, { eq: eqFn }) => eqFn(b.id, attempt.businessId),
    });
    const slug = business?.slug ?? 'fade-republic';
    const bookingPageBase = `${appBase}/b/${encodeURIComponent(slug)}?ilp_payment=${encodeURIComponent(paymentId)}`;

    // Customer cancelled / rejected consent on wallet screen
    if (result === 'grant_rejected' || !interactRef) {
      if (attempt.grantState === 'awaiting_authorization') {
        await deps.db
          .update(openPaymentsAttempts)
          .set({
            grantState: 'failed',
            authNonceHash: null,
            lastErrorCode: 'GRANT_REJECTED',
            lastErrorMessage: 'Customer rejected wallet payment authorization.',
            updatedAt: new Date(),
          })
          .where(eq(openPaymentsAttempts.id, attempt.id));
      }
      return c.redirect(`${bookingPageBase}&ilp_status=rejected`, 302);
    }

    // Idempotent replay protection: if already processed, redirect cleanly without re-creating outgoing payment
    if (attempt.grantState === 'outgoing_created' || attempt.grantState === 'verified') {
      const targetStatus = attempt.grantState === 'verified' ? 'confirmed' : 'verifying';
      return c.redirect(`${bookingPageBase}&ilp_status=${targetStatus}`, 302);
    }

    const incomingHash = state ? sha256Hex(state) : '';
    if (
      attempt.grantState !== 'awaiting_authorization' ||
      !attempt.authNonceHash ||
      attempt.authNonceHash !== incomingHash ||
      !attempt.continueUri ||
      !attempt.continueAccessTokenEnc ||
      !attempt.quoteId
    ) {
      return c.redirect(`${bookingPageBase}&ilp_status=invalid_state`, 302);
    }

    const booking = await deps.db.query.bookings.findFirst({
      where: eq(bookings.id, attempt.bookingId),
    });
    if (!booking?.holdExpiresAt) {
      return c.redirect(`${bookingPageBase}&ilp_status=expired`, 302);
    }

    const adapter = await deps.getAdapter();
    if (!adapter) {
      return c.redirect(`${bookingPageBase}&ilp_status=unavailable`, 302);
    }

    const rawCustWallet = await adapter.getWalletAddress(attempt.senderWalletAddress);
    const { clientNonce, interactNonce } = splitNonces(attempt.interactNonce);

    const completed = await completeAuthorizationAndCreateOutgoingPayment(adapter, {
      customerWallet: {
        id: rawCustWallet.id,
        assetCode: rawCustWallet.assetCode,
        assetScale: rawCustWallet.assetScale,
        authServer: rawCustWallet.authServer,
        resourceServer: rawCustWallet.resourceServer,
      },
      quoteId: attempt.quoteId,
      quoteExpiresAt: attempt.quoteExpiresAt,
      holdExpiresAt: booking.holdExpiresAt,
      interactRef,
      ...(hash ? { receivedHash: hash } : {}),
      clientNonce,
      interactNonce,
      continueUri: attempt.continueUri,
      continueAccessTokenEnc: attempt.continueAccessTokenEnc,
      tokenEncryptionKey: deps.tokenEncryptionKey,
      bookingId: booking.id,
      paymentId: attempt.paymentId,
    });

    if (!completed.ok) {
      await deps.db
        .update(openPaymentsAttempts)
        .set({
          grantState: 'failed',
          authNonceHash: null,
          lastErrorCode: completed.error.code,
          lastErrorMessage: completed.error.message,
          updatedAt: new Date(),
        })
        .where(eq(openPaymentsAttempts.id, attempt.id));
      return c.redirect(
        `${bookingPageBase}&ilp_status=error&ilp_code=${encodeURIComponent(completed.error.code)}`,
        302,
      );
    }

    await deps.db.transaction(async (tx) => {
      await tx
        .update(openPaymentsAttempts)
        .set({
          grantState: 'outgoing_created',
          authNonceHash: null,
          outgoingPaymentId: completed.value.outgoingPayment.id,
          outgoingAccessTokenEnc: completed.value.outgoingAccessTokenEnc,
          updatedAt: new Date(),
        })
        .where(eq(openPaymentsAttempts.id, attempt.id));

      await tx
        .update(payments)
        .set({ status: 'pending_verification', updatedAt: new Date() })
        .where(eq(payments.id, attempt.paymentId));
    });

    if (deps.enqueueVerify) {
      await deps.enqueueVerify(attempt.paymentId).catch((err) => {
        deps.logger.warn(
          { err, paymentId: attempt.paymentId },
          'interledger: failed to enqueue verify on GET callback',
        );
      });
    }

    const verification = await verifyAndSettleInterledgerPayment({
      db: deps.db,
      adapter,
      logger: deps.logger,
      paymentId: attempt.paymentId,
    });

    const nextStatus =
      verification.status === 'confirmed'
        ? 'confirmed'
        : verification.status === 'underpaid' || verification.status === 'late_requires_attention'
          ? 'attention'
          : 'verifying';

    return c.redirect(`${bookingPageBase}&ilp_status=${nextStatus}`, 302);
  });

  return app;
}
