export type OpenPaymentsErrorCode =
  | 'INVALID_WALLET_ADDRESS'
  | 'SSRF_BLOCKED'
  | 'WALLET_DISCOVERY_FAILED'
  | 'UNSUPPORTED_ASSET'
  | 'GRANT_REQUEST_FAILED'
  | 'GRANT_INTERACTION_REQUIRED'
  | 'GRANT_REJECTED'
  | 'GRANT_EXPIRED'
  | 'INVALID_CALLBACK_STATE'
  | 'INCOMING_PAYMENT_FAILED'
  | 'QUOTE_FAILED'
  | 'QUOTE_EXPIRED'
  | 'OUTGOING_PAYMENT_FAILED'
  | 'INSUFFICIENT_FUNDS'
  | 'PROVIDER_TIMEOUT'
  | 'UNDERPAID'
  | 'VERIFICATION_PENDING'
  | 'PRODUCTION_NOT_APPROVED';

export interface OpenPaymentsDomainError {
  code: OpenPaymentsErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export type Result<T, E = OpenPaymentsDomainError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
