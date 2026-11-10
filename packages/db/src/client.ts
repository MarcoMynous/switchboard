import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.ts';

function normalizeConnectionString(connectionString: string): string {
  if (connectionString.includes('uselibpqcompat=')) return connectionString;
  return connectionString.replace(
    /([?&])sslmode=(?:require|prefer|verify-ca)\b/g,
    '$1sslmode=verify-full',
  );
}

/**
 * Always `pg` Pool, never neon-http: the booking engine needs interactive
 * transactions (SELECT … FOR UPDATE). See docs/concerns/serverless-db-connections.md.
 */
export function createPool(connectionString: string, options: pg.PoolConfig = {}): pg.Pool {
  return new pg.Pool({
    connectionString: normalizeConnectionString(connectionString),
    // Small per-instance pool: Vercel scales out instances, Neon's pooler fans in.
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 30_000,
    ...options,
  });
}

export function createDb(pool: pg.Pool) {
  return drizzle({ client: pool, schema, casing: 'snake_case' });
}

export type Db = ReturnType<typeof createDb>;
export type { Pool } from 'pg';
