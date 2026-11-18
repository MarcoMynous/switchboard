import { NextResponse } from 'next/server';
import { customersPool, resolveAuthorizedBusiness } from '@/lib/customers-server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerFilter = url.searchParams.get('provider');
  const ctx = await resolveAuthorizedBusiness(request, url.searchParams.get('slug'));
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }

  const params: unknown[] = [ctx.business.id];
  let providerClause = '';
  if (providerFilter === 'kora' || providerFilter === 'interledger') {
    params.push(providerFilter);
    providerClause = `AND p.provider = $${params.length}`;
  }

  const res = await customersPool.query<{
    id: string;
    booking_id: string | null;
    provider: 'kora' | 'interledger';
    provider_environment: string;
    provider_reference: string | null;
    kora_reference: string | null;
    kind: string;
    amount_kobo: string;
    asset_code: string;
    asset_scale: number;
    provider_expected_amount: string | null;
    provider_received_amount: string | null;
    is_simulated: boolean;
    status: string;
    verified_at: string | null;
    created_at: string;
    customer_name: string | null;
    customer_phone: string | null;
    service_name: string | null;
    booking_status: string | null;
    grant_state: string | null;
    last_error_code: string | null;
  }>(
    `SELECT
       p.id::text AS id,
       p.booking_id::text AS booking_id,
       p.provider::text AS provider,
       p.provider_environment,
       p.provider_reference,
       p.kora_reference,
       p.kind::text AS kind,
       p.amount_kobo::text AS amount_kobo,
       p.asset_code,
       p.asset_scale,
       p.provider_expected_amount,
       p.provider_received_amount,
       p.is_simulated,
       p.status::text AS status,
       p.verified_at::text AS verified_at,
       p.created_at::text AS created_at,
       c.name AS customer_name,
       c.phone_e164 AS customer_phone,
       sv.name AS service_name,
       b.status::text AS booking_status,
       opa.grant_state::text AS grant_state,
       opa.last_error_code
     FROM payments p
     LEFT JOIN bookings b ON b.id = p.booking_id
     LEFT JOIN customers c ON c.id = b.customer_id
     LEFT JOIN services sv ON sv.id = b.service_id
     LEFT JOIN open_payments_attempts opa ON opa.payment_id = p.id
     WHERE p.business_id = $1 ${providerClause}
     ORDER BY p.created_at DESC
     LIMIT 100`,
    params,
  );

  // Separate reporting: never sum NGN and USD together, and separate simulated test-wallet funds from real funds
  let koraVerifiedKobo = 0;
  const interledgerVerifiedByAsset: Record<
    string,
    { assetCode: string; assetScale: number; realMinor: bigint; simulatedMinor: bigint }
  > = {};

  for (const row of res.rows) {
    if (row.status !== 'succeeded') continue;
    if (row.provider === 'kora') {
      koraVerifiedKobo += Number(row.amount_kobo);
    } else {
      const key = `${row.asset_code}:${row.asset_scale}`;
      let entry = interledgerVerifiedByAsset[key];
      if (!entry) {
        entry = {
          assetCode: row.asset_code,
          assetScale: row.asset_scale,
          realMinor: 0n,
          simulatedMinor: 0n,
        };
        interledgerVerifiedByAsset[key] = entry;
      }
      const val = BigInt(row.provider_received_amount ?? row.provider_expected_amount ?? '0');
      if (row.is_simulated) {
        entry.simulatedMinor += val;
      } else {
        entry.realMinor += val;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    transactions: res.rows.map((r) => ({
      id: r.id,
      bookingId: r.booking_id,
      provider: r.provider,
      providerEnvironment: r.provider_environment,
      reference: r.provider_reference ?? r.kora_reference ?? r.id,
      kind: r.kind,
      amountKobo: Number(r.amount_kobo),
      assetCode: r.asset_code,
      assetScale: r.asset_scale,
      providerExpectedAmount: r.provider_expected_amount,
      providerReceivedAmount: r.provider_received_amount,
      isSimulated: r.is_simulated,
      status: r.status,
      verifiedAt: r.verified_at,
      createdAt: r.created_at,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      serviceName: r.service_name,
      bookingStatus: r.booking_status,
      grantState: r.grant_state,
      recoveryStatus: r.last_error_code,
    })),
    summary: {
      koraVerifiedKobo,
      interledgerByAsset: Object.values(interledgerVerifiedByAsset).map((a) => ({
        assetCode: a.assetCode,
        assetScale: a.assetScale,
        realMinor: a.realMinor.toString(),
        simulatedMinor: a.simulatedMinor.toString(),
      })),
    },
  });
}
