// Postgres error recognition. Drizzle (≥ 0.44) wraps driver errors in DrizzleQueryError with the
// pg error as `cause`, so look at both levels.

interface PgErrorLike {
  code?: unknown;
  constraint?: unknown;
  cause?: unknown;
}

function pgError(e: unknown): PgErrorLike | null {
  if (typeof e !== 'object' || e === null) return null;
  const err = e as PgErrorLike;
  if (typeof err.code === 'string') return err;
  if (err.cause !== undefined) return pgError(err.cause);
  return null;
}

/** SQLSTATE 23P01: an EXCLUDE constraint refused the row (I1: the slot is taken). */
export function isExclusionViolation(e: unknown, constraint?: string): boolean {
  const pg = pgError(e);
  return pg?.code === '23P01' && (constraint === undefined || pg.constraint === constraint);
}

/** SQLSTATE 23505: a unique index refused the row (I4: an idempotency key raced). */
export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const pg = pgError(e);
  return pg?.code === '23505' && (constraint === undefined || pg.constraint === constraint);
}

/**
 * SQLSTATE 40P01 (deadlock) / 40001 (serialization failure): the transaction lost a race and was
 * rolled back, so it is safe to run again. Concurrent inserts checked by an EXCLUDE constraint can
 * deadlock on each other's uncommitted rows; under load (the chaos demo) this is routine.
 */
export function isRetryableConflict(e: unknown): boolean {
  const code = pgError(e)?.code;
  return code === '40P01' || code === '40001';
}

/** Runs `fn` again on deadlock/serialization failure, up to `attempts` times, with jittered backoff. */
export async function retryOnConflict<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isRetryableConflict(e) || attempt >= attempts) throw e;
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 10 * 2 ** attempt));
    }
  }
}
