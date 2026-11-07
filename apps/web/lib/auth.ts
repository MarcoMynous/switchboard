import { randomBytes } from 'node:crypto';
import { parseEnv, webSchema } from '@switchboard/env';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './auth-schema';

const env = parseEnv(webSchema);

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 30_000,
});

const db = drizzle(pool, { schema });

// Only when SKIP_ENV_VALIDATION=1 (offline CI build step) and no secret is provided,
// generate an ephemeral per-process secret so Better Auth never falls back to its
// static default placeholder during Next.js page data collection.
const secret =
  env.BETTER_AUTH_SECRET ||
  (process.env.SKIP_ENV_VALIDATION === '1' ? randomBytes(32).toString('hex') : undefined);

const baseURL =
  env.BETTER_AUTH_URL ||
  env.PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  baseURL,
  secret,
  emailAndPassword: { enabled: true },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        console.log(`[MagicLink] Sending login link to ${email}: ${url}`);
      },
    }),
  ],
});
