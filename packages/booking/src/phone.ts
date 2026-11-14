// Customers are keyed by E.164 phone per business (UNIQUE (business_id, phone_e164)), so every
// spelling of the same Nigerian number must collapse to one key or the CRM double-counts people.

const E164_RE = /^\+[1-9]\d{7,14}$/;

/**
 * Normalises a phone number to E.164. Nigerian local formats are assumed when there is no
 * country code: 0803 123 4567 → +2348031234567. Returns null when it can't be a phone number.
 */
export function toE164(input: string, defaultCountryCode = '234'): string | null {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length === 0) return null;

  let e164: string;
  if (hasPlus) e164 = `+${digits}`;
  else if (digits.startsWith('00')) e164 = `+${digits.slice(2)}`;
  else if (digits.startsWith(defaultCountryCode)) e164 = `+${digits}`;
  else if (digits.startsWith('0')) e164 = `+${defaultCountryCode}${digits.slice(1)}`;
  else e164 = `+${defaultCountryCode}${digits}`;

  if (!E164_RE.test(e164)) return null;
  // Nigerian mobile numbers are +234 followed by exactly 10 digits.
  if (e164.startsWith('+234') && e164.length !== 14) return null;
  return e164;
}
