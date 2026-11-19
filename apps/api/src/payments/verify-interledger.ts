import { confirmBooking } from '@switchboard/booking';
import { auditLog, type Db, openPaymentsAttempts, outbox, payments } from '@switchboard/db';
import {
  type DiscoveredWallet,
  decryptToken,
  type OpenPaymentsAdapter,
  verifyIncomingPaymentReceipt,
} from '@switchboard/open-payments';
import { and, eq, inArray } from 'drizzle-orm';
import type { Logger } from '../logger.ts';

export type InterledgerVerificationOutcome =
  | { status: 'confirmed'; bookingId: string; paymentId: string; overpaid: boolean }
  | {
      status: 'pending_verification';
      reason: string;
      providerState?: {
        incomingReceivedValue?: string;
        incomingCompleted?: boolean;
        outgoingFailed?: boolean;
        outgoingSentValue?: string;
      };
    }
  | { status: 'underpaid'; receivedValue: string; expectedValue: string }
  | { status: 'late_requires_attention'; bookingId: string; paymentId: string }
  | { status: 'already_terminal'; paymentStatus: string }
  | { status: 'error'; message: string };

export async function verifyAndSettleInterledgerPayment(deps: {
  db: Db;
  adapter: OpenPaymentsAdapter;
  logger: Logger;
  paymentId: string;
  tokenEncryptionKey?: string;
}): Promise<InterledgerVerificationOutcome> {
  const { db, adapter, logger, paymentId, tokenEncryptionKey } = deps;

  const attempt = await db.query.openPaymentsAttempts.findFirst({
    where: eq(openPaymentsAttempts.paymentId, paymentId),
  });
  if (!attempt || !attempt.incomingPaymentId) {
    return { status: 'error', message: 'Open Payments attempt or incoming payment not found' };
  }

  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
  });
  if (!payment) {
    return { status: 'error', message: 'Payment record not found' };
  }

  if (
    payment.status === 'succeeded' ||
    payment.status === 'failed' ||
    payment.status === 'expired'
  ) {
    return { status: 'already_terminal', paymentStatus: payment.status };
  }

  const business = await db.query.businesses.findFirst({
    where: (b, { eq: eqFn }) => eqFn(b.id, payment.businessId),
  });
  if (!business || !business.interledgerWalletAddress) {
    return { status: 'error', message: 'Business Interledger wallet not configured' };
  }

  let businessWallet: DiscoveredWallet;
  try {
    const w = await adapter.getWalletAddress(attempt.recipientWalletAddress);
    businessWallet = {
      id: w.id,
      ...(w.publicName ? { publicName: w.publicName } : {}),
      assetCode: w.assetCode,
      assetScale: w.assetScale,
      authServer: w.authServer,
      resourceServer: w.resourceServer,
    };
  } catch (err) {
    logger.warn({ paymentId, err }, 'interledger: failed to resolve business wallet during verify');
    return { status: 'pending_verification', reason: 'wallet_resolution_timeout' };
  }

  if (
    businessWallet.id.replace(/\/+$/, '') !== business.interledgerWalletAddress.replace(/\/+$/, '')
  ) {
    logger.error({ paymentId, businessId: business.id }, 'interledger: recipient wallet mismatch');
    return { status: 'error', message: 'Recipient wallet mismatch' };
  }

  const receipt = await verifyIncomingPaymentReceipt(adapter, {
    businessWallet,
    incomingPaymentId: attempt.incomingPaymentId,
    expectedAmount: {
      value: payment.providerExpectedAmount ?? '0',
      assetCode: payment.assetCode,
      assetScale: payment.assetScale,
    },
  });

  if (!receipt.ok) {
    if (receipt.error.retryable) {
      await db
        .update(payments)
        .set({ status: 'pending_verification', updatedAt: new Date() })
        .where(
          and(
            eq(payments.id, paymentId),
            inArray(payments.status, ['created', 'pending', 'pending_verification']),
          ),
        );
      return { status: 'pending_verification', reason: receipt.error.code };
    }
    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(
          and(
            eq(payments.id, paymentId),
            inArray(payments.status, ['created', 'pending', 'pending_verification']),
          ),
        );
      await tx
        .update(openPaymentsAttempts)
        .set({
          grantState: 'failed',
          lastErrorCode: receipt.error.code,
          lastErrorMessage: receipt.error.message,
          updatedAt: new Date(),
        })
        .where(eq(openPaymentsAttempts.paymentId, paymentId));
    });
    return { status: 'error', message: receipt.error.message };
  }

  if (receipt.value.underpaid) {
    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: 'failed',
          providerReceivedAmount: receipt.value.receivedAmount.value,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));
      await tx
        .update(openPaymentsAttempts)
        .set({
          grantState: 'failed',
          lastErrorCode: 'UNDERPAID',
          lastErrorMessage: `Received ${receipt.value.receivedAmount.value} of ${receipt.value.expectedAmount.value} ${receipt.value.expectedAmount.assetCode}`,
          updatedAt: new Date(),
        })
        .where(eq(openPaymentsAttempts.paymentId, paymentId));
      await tx.insert(outbox).values({
        topic: 'payment.underpaid',
        payload: {
          paymentId,
          bookingId: payment.bookingId,
          businessId: payment.businessId,
          provider: 'interledger',
          receivedValue: receipt.value.receivedAmount.value,
          expectedValue: receipt.value.expectedAmount.value,
          assetCode: receipt.value.expectedAmount.assetCode,
        },
      });
    });
    return {
      status: 'underpaid',
      receivedValue: receipt.value.receivedAmount.value,
      expectedValue: receipt.value.expectedAmount.value,
    };
  }

  if (!receipt.value.verified) {
    let outgoingFailed: boolean | undefined;
    let outgoingSentValue: string | undefined;
    // Check whether the customer's outgoing payment failed on the provider (e.g. insufficient funds / ILP routing)
    if (attempt.outgoingPaymentId && attempt.outgoingAccessTokenEnc && tokenEncryptionKey) {
      try {
        const outgoingToken = decryptToken(attempt.outgoingAccessTokenEnc, tokenEncryptionKey);
        const outgoing = await adapter.getOutgoingPayment(attempt.outgoingPaymentId, outgoingToken);
        outgoingFailed = outgoing.failed;
        outgoingSentValue = outgoing.sentAmount.value;
        logger.info(
          {
            paymentId,
            outgoingPaymentId: attempt.outgoingPaymentId,
            outgoingFailed: outgoing.failed ?? false,
            sentAmount: outgoing.sentAmount,
          },
          'interledger: inspected outgoing payment state',
        );
        if (outgoing.failed) {
          const failMsg =
            'Test wallet outgoing payment failed on the provider (check EUR wallet balance or test-network liquidity).';
          await db.transaction(async (tx) => {
            await tx
              .update(payments)
              .set({ status: 'failed', updatedAt: new Date() })
              .where(
                and(
                  eq(payments.id, paymentId),
                  inArray(payments.status, ['created', 'pending', 'pending_verification']),
                ),
              );
            await tx
              .update(openPaymentsAttempts)
              .set({
                grantState: 'failed',
                lastErrorCode: 'OUTGOING_PAYMENT_FAILED',
                lastErrorMessage: failMsg,
                updatedAt: new Date(),
              })
              .where(eq(openPaymentsAttempts.paymentId, paymentId));
          });
          return { status: 'error', message: failMsg };
        }
      } catch (err) {
        logger.warn({ paymentId, err }, 'interledger: failed to inspect outgoing payment');
      }
    }
    logger.info(
      {
        paymentId,
        incomingPaymentId: attempt.incomingPaymentId,
        receivedAmount: receipt.value.receivedAmount,
        expectedAmount: receipt.value.expectedAmount,
        completed: receipt.value.completed,
      },
      'interledger: incoming payment awaiting settlement',
    );
    await db
      .update(payments)
      .set({ status: 'pending_verification', updatedAt: new Date() })
      .where(
        and(
          eq(payments.id, paymentId),
          inArray(payments.status, ['created', 'pending', 'pending_verification']),
        ),
      );
    return {
      status: 'pending_verification',
      reason: 'awaiting_settlement',
      providerState: {
        incomingReceivedValue: receipt.value.receivedAmount.value,
        incomingCompleted: receipt.value.completed,
        ...(outgoingFailed !== undefined ? { outgoingFailed } : {}),
        ...(outgoingSentValue !== undefined ? { outgoingSentValue } : {}),
      },
    };
  }

  if (!payment.bookingId) {
    return { status: 'error', message: 'Payment has no associated booking' };
  }
  const bookingId = payment.bookingId;

  // Verified on recipient incomingPayment! Confirm booking inside one Postgres transaction.
  const txOutcome = await db.transaction(async (tx) => {
    const updatedPayments = await tx
      .update(payments)
      .set({
        status: 'succeeded',
        verifiedAt: new Date(),
        providerReceivedAmount: receipt.value.receivedAmount.value,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(payments.id, paymentId),
          inArray(payments.status, ['created', 'pending', 'pending_verification']),
        ),
      )
      .returning({ id: payments.id });

    if (updatedPayments.length === 0) {
      return { kind: 'already_terminal' as const };
    }

    await tx
      .update(openPaymentsAttempts)
      .set({
        grantState: 'verified',
        lastErrorCode: receipt.value.overpaid ? 'OVERPAID_SURPLUS_REVIEW' : null,
        updatedAt: new Date(),
      })
      .where(eq(openPaymentsAttempts.paymentId, paymentId));

    const confirmed = await confirmBooking(tx, payment.businessId, bookingId);
    if (confirmed.ok) {
      await tx.insert(auditLog).values({
        businessId: payment.businessId,
        actor: 'system',
        action: 'payment.interledger.verified',
        entity: 'payment',
        entityId: paymentId,
        after: {
          bookingId,
          provider: 'interledger',
          receivedAmount: receipt.value.receivedAmount,
          overpaid: receipt.value.overpaid,
          isSimulated: payment.isSimulated,
        },
      });
      return { kind: 'confirmed' as const, overpaid: receipt.value.overpaid };
    }

    // Hold expired or booking no longer held -> late payment recovery (requires human review / compensating return)
    await tx
      .update(openPaymentsAttempts)
      .set({
        lastErrorCode: 'LATE_PAYMENT_NEEDS_RECOVERY',
        lastErrorMessage:
          'Payment arrived after booking hold expired; manual slot check or compensating return required.',
        updatedAt: new Date(),
      })
      .where(eq(openPaymentsAttempts.paymentId, paymentId));

    await tx.insert(outbox).values({
      topic: 'payment.late_requires_attention',
      payload: {
        paymentId,
        bookingId,
        businessId: payment.businessId,
        provider: 'interledger',
        receivedAmount: receipt.value.receivedAmount,
      },
    });
    return { kind: 'late_requires_attention' as const };
  });

  if (txOutcome.kind === 'already_terminal') {
    return { status: 'already_terminal', paymentStatus: payment.status };
  }
  if (txOutcome.kind === 'late_requires_attention') {
    return { status: 'late_requires_attention', bookingId, paymentId };
  }
  return { status: 'confirmed', bookingId, paymentId, overpaid: txOutcome.overpaid };
}
