import { NextResponse } from 'next/server';

export type BookingDepositStatus =
  | 'held'
  | 'pending_verification'
  | 'confirmed'
  | 'underpaid'
  | 'expired'
  | 'cancelled';

interface StoredBookingStatus {
  reference: string;
  status: BookingDepositStatus;
  amountExpectedKobo: number;
  amountPaidKobo: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  expiresAtMs: number;
  updatedAt: string;
}

const bookingStatusStore = new Map<string, StoredBookingStatus>();

function isTerminalStatus(status: BookingDepositStatus): boolean {
  return status === 'confirmed' || status === 'expired' || status === 'cancelled';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get('reference')?.trim();

  if (!reference) {
    return NextResponse.json({ ok: false, error: 'Missing reference parameter' }, { status: 400 });
  }

  const record = bookingStatusStore.get(reference);
  if (!record) {
    return NextResponse.json({
      ok: true,
      found: false,
      reference,
      status: 'held' as BookingDepositStatus,
      terminal: false,
      amountExpectedKobo: 0,
      amountPaidKobo: 0,
      shortfallKobo: 0,
    });
  }

  const now = Date.now();
  let currentStatus = record.status;
  if ((currentStatus === 'held' || currentStatus === 'underpaid') && now >= record.expiresAtMs) {
    currentStatus = 'expired';
    record.status = 'expired';
    record.updatedAt = new Date().toISOString();
    bookingStatusStore.set(reference, record);
  }

  const remainingSeconds = Math.max(0, Math.floor((record.expiresAtMs - now) / 1000));
  const shortfallKobo = Math.max(0, record.amountExpectedKobo - record.amountPaidKobo);

  return NextResponse.json({
    ok: true,
    found: true,
    reference: record.reference,
    status: currentStatus,
    terminal: isTerminalStatus(currentStatus),
    amountExpectedKobo: record.amountExpectedKobo,
    amountPaidKobo: record.amountPaidKobo,
    shortfallKobo,
    bankName: record.bankName,
    accountNumber: record.accountNumber,
    accountName: record.accountName,
    remainingSeconds,
    updatedAt: record.updatedAt,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      reference?: string;
      status?: BookingDepositStatus;
      amountExpectedKobo?: number;
      amountPaidKobo?: number;
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
      ttlSeconds?: number;
    };

    const reference = body.reference?.trim();
    if (!reference) {
      return NextResponse.json({ ok: false, error: 'Missing reference' }, { status: 400 });
    }

    const existing = bookingStatusStore.get(reference);
    const amountExpectedKobo = body.amountExpectedKobo ?? existing?.amountExpectedKobo ?? 150_000;
    const status: BookingDepositStatus = body.status ?? existing?.status ?? 'held';
    const amountPaidKobo =
      body.amountPaidKobo ??
      (status === 'confirmed'
        ? amountExpectedKobo
        : status === 'underpaid'
          ? Math.max(10_000, Math.round(amountExpectedKobo * 0.6))
          : (existing?.amountPaidKobo ?? 0));

    const ttlMs = (body.ttlSeconds ?? 900) * 1000;
    const nextRecord: StoredBookingStatus = {
      reference,
      status,
      amountExpectedKobo,
      amountPaidKobo,
      bankName: body.bankName ?? existing?.bankName ?? 'Wema Bank',
      accountNumber: body.accountNumber ?? existing?.accountNumber ?? '7829104482',
      accountName: body.accountName ?? existing?.accountName ?? 'Switchboard Business',
      expiresAtMs: existing?.expiresAtMs ?? Date.now() + ttlMs,
      updatedAt: new Date().toISOString(),
    };

    bookingStatusStore.set(reference, nextRecord);

    return NextResponse.json({
      ok: true,
      reference: nextRecord.reference,
      status: nextRecord.status,
      terminal: isTerminalStatus(nextRecord.status),
      amountExpectedKobo: nextRecord.amountExpectedKobo,
      amountPaidKobo: nextRecord.amountPaidKobo,
      shortfallKobo: Math.max(0, nextRecord.amountExpectedKobo - nextRecord.amountPaidKobo),
      bankName: nextRecord.bankName,
      accountNumber: nextRecord.accountNumber,
      accountName: nextRecord.accountName,
      remainingSeconds: Math.max(0, Math.floor((nextRecord.expiresAtMs - Date.now()) / 1000)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Could not update booking status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
