'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';

type IntegrationStatus =
  | 'not_configured'
  | 'incomplete'
  | 'connected'
  | 'test_mode'
  | 'unavailable';

const STATUS_META: Record<IntegrationStatus, { label: string; badgeClass: string }> = {
  not_configured: {
    label: 'Not Configured',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  incomplete: {
    label: 'Configuration Incomplete',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  connected: {
    label: 'Connected',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  test_mode: {
    label: 'Test Mode',
    badgeClass: 'bg-[#F5B700]/20 text-[#7A5900] border-[#F5B700]/40',
  },
  unavailable: {
    label: 'Unavailable',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
};

export function IntegrationsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [productionApproved, setProductionApproved] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [environment, setEnvironment] = useState<'testnet' | 'production'>('testnet');
  const [walletAddress, setWalletAddress] = useState('');
  const [assetCode, setAssetCode] = useState<string | null>(null);
  const [assetScale, setAssetScale] = useState<number | null>(null);
  const [status, setStatus] = useState<IntegrationStatus>('not_configured');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/interledger', { cache: 'no-store' });
      const data = (await res.json()) as {
        ok?: boolean;
        serverReady?: boolean;
        productionApproved?: boolean;
        config?: {
          enabled: boolean;
          environment: 'testnet' | 'production';
          walletAddress: string;
          assetCode: string | null;
          assetScale: number | null;
          status: IntegrationStatus;
        };
      };
      if (data.ok && data.config) {
        setServerReady(Boolean(data.serverReady));
        setProductionApproved(Boolean(data.productionApproved));
        setEnabled(data.config.enabled);
        setEnvironment(data.config.environment);
        setWalletAddress(data.config.walletAddress);
        setAssetCode(data.config.assetCode);
        setAssetScale(data.config.assetScale);
        setStatus(data.config.status);
      }
    } catch {
      setErrorMsg('Failed to load Interledger integration settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/integrations/interledger', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, environment, walletAddress }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: IntegrationStatus;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error ?? 'Could not save Interledger settings.');
        return;
      }
      if (data.status) setStatus(data.status);
      setNotice(data.message ?? 'Interledger settings saved.');
    } catch {
      setErrorMsg('Network error while saving settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setNotice(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/integrations/interledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        connected?: boolean;
        status?: IntegrationStatus;
        message?: string;
        wallet?: { assetCode: string; assetScale: number };
      };
      if (data.status) setStatus(data.status);
      if (data.wallet) {
        setAssetCode(data.wallet.assetCode);
        setAssetScale(data.wallet.assetScale);
      }
      if (data.connected) {
        setNotice(data.message ?? 'Connection verified.');
      } else {
        setErrorMsg(data.message ?? 'Connection test failed.');
      }
    } catch {
      setErrorMsg('Network error while testing connection.');
    } finally {
      setTesting(false);
    }
  };

  const statusMeta = STATUS_META[status];

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Integrations</h1>
            <p className="text-sm text-text-secondary mt-1">
              Connect payment providers and external channels for your workspace.
            </p>
          </div>
        </div>

        {/* Interledger Open Payments Card */}
        <div className="rounded-xl border border-border bg-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#22306B]/10 text-[#22306B] flex items-center justify-center shrink-0">
                <AppIcon name="account_balance_wallet" className="text-xl" />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary">Interledger Open Payments</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Accept appointment deposits from any Open Payments-enabled wallet alongside Kora
                  bank transfers.
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusMeta.badgeClass}`}
            >
              {statusMeta.label}
            </span>
          </div>

          {/* Readiness Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-[#F5F6FA] border border-border">
              <p className="text-[11px] font-semibold text-text-secondary uppercase">
                Client Auth Readiness
              </p>
              <p className="text-xs font-bold text-text-primary mt-1">
                {serverReady ? 'Server key configured' : 'Missing server Open Payments keys'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F6FA] border border-border">
              <p className="text-[11px] font-semibold text-text-secondary uppercase">
                Provider Environment
              </p>
              <p className="text-xs font-bold text-text-primary mt-1">
                {environment === 'testnet'
                  ? 'Interledger Testnet (Simulated)'
                  : 'Production (Live Funds)'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#F5F6FA] border border-border">
              <p className="text-[11px] font-semibold text-text-secondary uppercase">
                Supported Payment Assets
              </p>
              <p className="text-xs font-bold text-text-primary mt-1">
                {assetCode
                  ? `${assetCode} (scale ${assetScale ?? 2}) · NGN, USD`
                  : 'NGN, USD (Test connection to detect wallet asset)'}
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-xs text-text-secondary">Loading integration settings…</p>
          ) : (
            <div className="space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-[#22306B]"
                />
                <span className="text-sm font-semibold text-text-primary">
                  Enable Interledger Wallet payments on booking page
                </span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label
                    htmlFor="biz-ilp-wallet"
                    className="block text-xs font-semibold text-text-primary mb-1"
                  >
                    Business Receiving Wallet Address
                  </label>
                  <input
                    id="biz-ilp-wallet"
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="https://ilp.interledger-test.dev/fade-republic"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-[#22306B]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="biz-ilp-env"
                    className="block text-xs font-semibold text-text-primary mb-1"
                  >
                    Environment
                  </label>
                  <select
                    id="biz-ilp-env"
                    value={environment}
                    onChange={(e) =>
                      setEnvironment(e.target.value === 'production' ? 'production' : 'testnet')
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm font-semibold text-text-primary"
                  >
                    <option value="testnet">Testnet (Simulated Money)</option>
                    <option value="production" disabled={!productionApproved}>
                      Production {!productionApproved ? '(Requires Live Approval)' : ''}
                    </option>
                  </select>
                </div>
              </div>

              {notice && (
                <div className="px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900">
                  {notice}
                </div>
              )}

              {errorMsg && (
                <div className="px-3.5 py-2.5 rounded-lg bg-amber-50 border border-amber-300 text-xs font-medium text-amber-900">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="px-4 py-2 rounded-lg bg-[#22306B] hover:bg-[#192350] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save configuration'}
                </button>
                <button
                  type="button"
                  disabled={testing || !walletAddress.trim()}
                  onClick={() => void handleTestConnection()}
                  className="px-4 py-2 rounded-lg border border-[#22306B]/30 bg-[#F5F6FA] hover:bg-[#22306B]/10 text-[#22306B] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {testing ? 'Testing connection…' : 'Test connection'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
