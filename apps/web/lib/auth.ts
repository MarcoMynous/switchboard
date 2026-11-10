import { randomBytes } from 'node:crypto';
import { parseEnv, webSchema } from '@switchboard/env';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/node-postgres';
import nodemailer from 'nodemailer';
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
        // Resolve the origin the user actually came from so links work on both localhost and Vercel
        const reqOrigin = request?.headers?.get('origin');
        const resolvedUrl =
          reqOrigin && url.startsWith(baseURL) ? url.replace(baseURL, reqOrigin) : url;
        const verifyPageUrl = `${reqOrigin || baseURL}/auth/verify?token=${encodeURIComponent(token)}`;

        if (!transporter) {
          console.log(`[MagicLink] No SMTP configured. Login link for ${email}: ${resolvedUrl}`);
          return;
        }

        const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sign in to Switchboard</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F7F8FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0C1233;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7F8FB;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#FFFFFF;border-radius:20px;border:1px solid #E5E7EB;overflow:hidden;box-shadow:0 8px 30px rgba(12,18,51,0.06);">
            <tr>
              <td style="background:linear-gradient(135deg,#181F63 0%,#3B32B8 55%,#6258E8 100%);padding:28px 32px;text-align:left;">
                <span style="display:inline-block;font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.03em;">
                  Switchboard<span style="color:#F59E0B;">.</span>
                </span>
                <p style="margin:6px 0 0 0;font-size:12px;color:#C4C0FF;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">
                  Enterprise Passwordless Sign-In
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#0C1233;font-weight:700;">
                  Your secure sign-in link is ready
                </h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#475569;">
                  Click the button below to sign in to your Switchboard workspace as <strong style="color:#0C1233;">${email}</strong>. This single-use magic link expires in <strong>15 minutes</strong>.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
                  <tr>
                    <td align="center" style="border-radius:12px;background-color:#6258E8;">
                      <a href="${verifyPageUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:12px;">
                        Verify &amp; Sign in to Switchboard &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px 0;font-size:13px;color:#64748B;">
                  Or copy and paste this direct verification link into your browser:
                </p>
                <p style="margin:0 0 24px 0;font-size:12px;word-break:break-all;">
                  <a href="${resolvedUrl}" style="color:#493CCE;text-decoration:underline;">${verifyPageUrl}</a>
                </p>
                <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
                <p style="margin:0;font-size:12px;line-height:1.5;color:#94A3B8;">
                  If you did not request this email, you can safely ignore it. Your workspace remains protected.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

        await transporter.sendMail({
          from: smtpFrom,
          to: email,
          subject: 'Sign in to Switchboard — Your Magic Link',
          text: `Sign in to Switchboard as ${email}:\n\n${resolvedUrl}\n\nOr verify at:\n${verifyPageUrl}\n\nThis link expires in 15 minutes.`,
          html,
        });
      },
    }),
  ],
});
