import { err, ok, type Result } from './errors.ts';

export interface AssetAmount {
  value: string;
  assetCode: string;
  assetScale: number;
}

export interface DepositConversionResult {
  amount: AssetAmount;
  sourceAmountKobo: number;
  isCrossCurrency: boolean;
  conversionRateUsed: number | null;
}

/**
 * Converts a booking deposit obligation (always stored in integer NGN kobo)
 * into the target Open Payments wallet asset and scale.
 * Never silently treats USD or other assets as 1:1 NGN.
 */
export function convertKoboToWalletAsset(input: {
  amountKobo: number;
  targetAssetCode: string;
  targetAssetScale: number;
  ngnToUsdRate: number;
}): Result<DepositConversionResult> {
  const { amountKobo, targetAssetCode, targetAssetScale, ngnToUsdRate } = input;
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    return err({
      code: 'UNSUPPORTED_ASSET',
      message: 'Deposit amount must be a positive integer in kobo.',
      retryable: false,
    });
  }
  if (!Number.isInteger(targetAssetScale) || targetAssetScale < 0 || targetAssetScale > 18) {
    return err({
      code: 'UNSUPPORTED_ASSET',
      message: `Unsupported asset scale: ${String(targetAssetScale)}`,
      retryable: false,
    });
  }

  const code = targetAssetCode.toUpperCase();
  if (code === 'NGN') {
    const value =
      targetAssetScale >= 2
        ? BigInt(amountKobo) * 10n ** BigInt(targetAssetScale - 2)
        : BigInt(amountKobo) / 10n ** BigInt(2 - targetAssetScale);
    return ok({
      amount: {
        value: (value > 0n ? value : 1n).toString(),
        assetCode: 'NGN',
        assetScale: targetAssetScale,
      },
      sourceAmountKobo: amountKobo,
      isCrossCurrency: false,
      conversionRateUsed: 1,
    });
  }

  if (code === 'USD') {
    if (!Number.isFinite(ngnToUsdRate) || ngnToUsdRate <= 0) {
      return err({
        code: 'UNSUPPORTED_ASSET',
        message: 'A valid NGN-to-USD conversion rate is required for USD wallets.',
        retryable: false,
      });
    }
    const naira = amountKobo / 100;
    const usdMajor = naira * ngnToUsdRate;
    const scaled = Math.max(1, Math.round(usdMajor * 10 ** targetAssetScale));
    return ok({
      amount: {
        value: String(scaled),
        assetCode: 'USD',
        assetScale: targetAssetScale,
      },
      sourceAmountKobo: amountKobo,
      isCrossCurrency: true,
      conversionRateUsed: ngnToUsdRate,
    });
  }

  return err({
    code: 'UNSUPPORTED_ASSET',
    message: `Wallet asset ${code} is not currently supported for Switchboard deposits.`,
    retryable: false,
    details: { assetCode: code },
  });
}

export function compareMinorUnits(a: string, b: string): -1 | 0 | 1 {
  const bigA = BigInt(a);
  const bigB = BigInt(b);
  if (bigA < bigB) return -1;
  if (bigA > bigB) return 1;
  return 0;
}

export function formatAssetAmount(amount: AssetAmount): string {
  const raw = BigInt(amount.value);
  const scale = amount.assetScale;
  if (scale === 0) return `${raw.toString()} ${amount.assetCode}`;
  const divisor = 10n ** BigInt(scale);
  const whole = raw / divisor;
  const frac = (raw % divisor).toString().padStart(scale, '0');
  return `${whole.toString()}.${frac} ${amount.assetCode}`;
}
