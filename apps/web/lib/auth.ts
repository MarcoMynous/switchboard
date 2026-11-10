import { randomBytes } from 'node:crypto';
import { parseEnv, webSchema } from '@switchboard/env';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/node-postgres';
import nodemailer from 'nodemailer';
import { Pool } from 'pg';
import * as schema from './auth-schema';
import { buildMagicLinkEmail } from './magic-link-email';

const env = parseEnv(webSchema);

const normalizedDatabaseUrl = env.DATABASE_URL.includes('uselibpqcompat=')
  ? env.DATABASE_URL
  : env.DATABASE_URL.replace(
      /([?&])sslmode=(?:require|prefer|verify-ca)\b/g,
      '$1sslmode=verify-full',
    );

const pool = new Pool({
  connectionString: normalizedDatabaseUrl,
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
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');

const smtpUser = env.SMTP_USER || process.env.SMTP_USER;
const smtpPass = env.SMTP_PASS || process.env.SMTP_PASS;
const smtpHost = env.SMTP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(env.SMTP_PORT || process.env.SMTP_PORT || 465);
const smtpFrom =
  env.SMTP_FROM ||
  process.env.SMTP_FROM ||
  (smtpUser ? `Switchboard <${smtpUser}>` : 'Switchboard <no-reply@switchboard.ng>');

const transporter =
  smtpUser && smtpPass
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      })
    : null;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  baseURL,
  secret,
  trustedOrigins: [
    'http://localhost:3000',
    'https://switchboard-bm.vercel.app',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ],
  emailAndPassword: { enabled: true },
  plugins: [
    magicLink({
      expiresIn: 60 * 15, // 15 minutes
      sendMagicLink: async ({ email, token, url }, request) => {
        const reqOrigin = request?.headers?.get('origin');
        const effectiveOrigin = reqOrigin || baseURL;
        const resolvedUrl =
          reqOrigin && url.startsWith(baseURL) ? url.replace(baseURL, reqOrigin) : url;
        const verifyPageUrl = `${effectiveOrigin}/auth/verify?token=${encodeURIComponent(token)}`;

        let originHost = 'switchboard-bm.vercel.app';
        try {
          originHost = new URL(effectiveOrigin).host;
        } catch {
          // Keep default host label
        }

        if (!transporter) {
          console.log(`[MagicLink] No SMTP configured. Login link for ${email}: ${resolvedUrl}`);
          return;
        }

        const { subject, html, text } = buildMagicLinkEmail({
          email,
          verifyPageUrl,
          directAuthUrl: resolvedUrl,
          originHost,
        });

        await transporter.sendMail({
          from: smtpFrom,
          to: email,
          subject,
          text,
          html,
        });
      },
    }),
  ],
});
