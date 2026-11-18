import { NextResponse } from 'next/server';
import { customersPool, resolveAuthorizedBusiness } from '@/lib/customers-server';

function resolveInterledgerStatus(row: {
  interledgerEnabled: boolean;
  interledgerWalletAddress: string | null;
  interledgerEnvironment: string;
  interledgerStatus: string;
}): 'not_configured' | 'incomplete' | 'connected' | 'test_mode' | 'unavailable' {
  if (!row.interledgerWalletAddress) return 'not_configured';
  if (!row.interledgerEnabled) return 'incomplete';
  if (
    row.interledgerStatus === 'test_mode' ||
    row.interledgerStatus === 'connected' ||
    row.interledgerStatus === 'unavailable'
  ) {
    return row.interledgerStatus;
  }
  return 'incomplete';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ctx = await resolveAuthorizedBusiness(request, url.searchParams.get('slug'));
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }

  const res = await customersPool.query<{
    interledger_enabled: boolean;
    interledger_environment: string;
    interledger_wallet_address: string | null;
    interledger_auth_server: string | null;
    interledger_resource_server: string | null;
    interledger_asset_code: string | null;
    interledger_asset_scale: number | null;
    interledger_status: string;
    interledger_last_checked_at: string | null;
  }>(
    `SELECT
       interledger_enabled,
       interledger_environment,
       interledger_wallet_address,
       interledger_auth_server,
       interledger_resource_server,
       interledger_asset_code,
       interledger_asset_scale,
       interledger_status,
       interledger_last_checked_at::text
     FROM businesses
     WHERE id = $1
     LIMIT 1`,
    [ctx.business.id],
  );

  const row = res.rows[0];
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });
  }

  const serverEnabled = process.env.OPEN_PAYMENTS_ENABLED === 'true';
  const productionApproved = process.env.OPEN_PAYMENTS_PRODUCTION_APPROVED === 'true';

  return NextResponse.json({
    ok: true,
    serverReady: serverEnabled,
    productionApproved,
    supportedAssets: ['NGN', 'USD'],
    config: {
      enabled: row.interledger_enabled,
      environment: row.interledger_environment === 'production' ? 'production' : 'testnet',
      walletAddress: row.interledger_wallet_address ?? '',
      authServer: row.interledger_auth_server,
      resourceServer: row.interledger_resource_server,
      assetCode: row.interledger_asset_code,
      assetScale: row.interledger_asset_scale,
      status: resolveInterledgerStatus({
        interledgerEnabled: row.interledger_enabled,
        interledgerWalletAddress: row.interledger_wallet_address,
        interledgerEnvironment: row.interledger_environment,
        interledgerStatus: row.interledger_status,
      }),
      lastCheckedAt: row.interledger_last_checked_at,
    },
  });
}

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const ctx = await resolveAuthorizedBusiness(request, url.searchParams.get('slug'));
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    enabled?: boolean;
    walletAddress?: string;
    environment?: 'testnet' | 'production';
  } | null;

  if (!body) {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const environment = body.environment === 'production' ? 'production' : 'testnet';
  if (environment === 'production' && process.env.OPEN_PAYMENTS_PRODUCTION_APPROVED !== 'true') {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Production Open Payments is disabled until live-provider KYB/compliance verification is approved.',
      },
      { status: 422 },
    );
  }

  const walletAddress = body.walletAddress?.trim() || null;
  const enabled = Boolean(body.enabled);
  const nextStatus = !walletAddress ? 'not_configured' : 'incomplete';

  await customersPool.query(
    `UPDATE businesses
     SET interledger_enabled = $1,
         interledger_environment = $2,
         interledger_wallet_address = $3,
         interledger_status = $4,
         updated_at = now()
     WHERE id = $5`,
    [enabled, environment, walletAddress, nextStatus, ctx.business.id],
  );

  return NextResponse.json({
    ok: true,
    status: nextStatus,
    message: walletAddress
      ? 'Settings saved. Run Test Connection to verify wallet discovery and client authentication.'
      : 'Interledger wallet address cleared.',
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const ctx = await resolveAuthorizedBusiness(request, url.searchParams.get('slug'));
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { walletAddress?: string } | null;
  const walletAddress = body?.walletAddress?.trim();
  if (!walletAddress) {
    return NextResponse.json(
      { ok: false, error: 'Enter a receiving wallet address to test.' },
      { status: 400 },
    );
  }

  const apiOrigin = (process.env.API_ORIGIN || 'http://localhost:4000').replace(/\/+$/, '');
  try {
    const apiRes = await fetch(`${apiOrigin}/integrations/interledger/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    });
    const payload = (await apiRes.json()) as {
      connected?: boolean;
      status?: string;
      message?: string;
      error?: { message?: string };
      wallet?: {
        id: string;
        assetCode: string;
        assetScale: number;
        authServer: string;
        resourceServer: string;
      };
    };

    const nextStatus = payload.connected
      ? payload.status === 'connected'
        ? 'connected'
        : 'test_mode'
      : 'unavailable';

    await customersPool.query(
      `UPDATE businesses
       SET interledger_wallet_address = $1,
           interledger_auth_server = $2,
           interledger_resource_server = $3,
           interledger_asset_code = $4,
           interledger_asset_scale = $5,
           interledger_status = $6,
           interledger_last_checked_at = now(),
           updated_at = now()
       WHERE id = $7`,
      [
        payload.wallet?.id ?? walletAddress,
        payload.wallet?.authServer ?? null,
        payload.wallet?.resourceServer ?? null,
        payload.wallet?.assetCode ?? null,
        payload.wallet?.assetScale ?? null,
        nextStatus,
        ctx.business.id,
      ],
    );

    return NextResponse.json({
      ok: true,
      connected: Boolean(payload.connected),
      status: nextStatus,
      wallet: payload.wallet ?? null,
      message:
        payload.error?.message ??
        payload.message ??
        (payload.connected
          ? 'Wallet discovery and authenticated Open Payments grant succeeded.'
          : 'Connection check could not verify the wallet.'),
    });
  } catch {
    return NextResponse.json(
      {
        ok: true,
        connected: false,
        status: 'unavailable',
        message: 'Could not reach the Switchboard API service to test the wallet connection.',
      },
      { status: 200 },
    );
  }
}
