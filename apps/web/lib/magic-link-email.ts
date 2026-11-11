export interface MagicLinkEmailParams {
  email: string;
  verifyPageUrl: string;
  directAuthUrl: string;
  originHost?: string;
  requestedAt?: Date;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildMagicLinkEmail({
  email,
  verifyPageUrl,
  directAuthUrl,
  originHost = 'switchboard-bm.vercel.app',
  requestedAt = new Date(),
}: MagicLinkEmailParams): { subject: string; html: string; text: string } {
  const safeEmail = escapeHtml(email);
  const safeVerifyUrl = escapeHtml(verifyPageUrl);
  const safeDirectUrl = escapeHtml(directAuthUrl);
  const safeHost = escapeHtml(originHost);

  const formattedTimeWat = new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(requestedAt);

  const subject = 'Sign in to Switchboard — Your 15-minute magic link';

  const text = [
    'SWITCHBOARD — AI Front Desk & Verified Booking Engine',
    '=====================================================',
    '',
    'Your business never stops. Neither should your front desk.',
    '',
    `We received a request to sign in to Switchboard using ${email}.`,
    '',
    'Click the link below to verify and open your workspace (valid for 15 minutes):',
    verifyPageUrl,
    '',
    'Direct one-click sign-in fallback:',
    directAuthUrl,
    '',
    `Requested: ${formattedTimeWat} (WAT · Africa/Lagos)`,
    `Workspace Host: ${originHost}`,
    '',
    'If you did not request this sign-in link, you can safely ignore this email. No changes have been made to your account.',
    '',
    '— Switchboard (https://switchboard-bm.vercel.app)',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>Sign in to Switchboard</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F2F4FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0C1233;-webkit-font-smoothing:antialiased;">
    <!-- Hidden Inbox Preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#F2F4FC;">
      Your single-use Switchboard sign-in link for ${safeEmail} is ready. Valid for 15 minutes.&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(160deg,#EEF1FA 0%,#F7F8FC 55%,#FFFDF8 100%);padding:36px 14px;">
      <tr>
        <td align="center">
          <!-- Outer Container (Max 560px) -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#FFFFFF;border-radius:24px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 16px 48px -12px rgba(12,18,51,0.10);">

            <!-- Top Signature Gradient Accent Strip -->
            <tr>
              <td style="height:5px;background:linear-gradient(90deg,#181F63 0%,#6258E8 55%,#F59E0B 100%);font-size:0;line-height:0;">&nbsp;</td>
            </tr>

            <!-- Dark Midnight Hero Header (#101827 -> #181F63) -->
            <tr>
              <td style="background:linear-gradient(145deg,#0E1330 0%,#171F5C 60%,#252275 100%);padding:32px 32px 28px 32px;text-align:left;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <!-- Email-Safe Switchboard Brand Lockup -->
                    <td valign="middle">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <!-- Squircle Icon with 5 Signal Bars + Amber Arc -->
                          <td valign="middle" style="padding-right:12px;">
                            <div style="width:42px;height:42px;border-radius:12px;background-color:#141A56;border:1px solid rgba(255,255,255,0.16);text-align:center;padding-top:7px;box-sizing:border-box;">
                              <div style="line-height:20px;height:20px;">
                                <span style="display:inline-block;width:3px;height:9px;background-color:#FFFFFF;border-radius:2px;vertical-align:middle;margin:0 1px;"></span>
                                <span style="display:inline-block;width:3px;height:14px;background-color:#FFFFFF;border-radius:2px;vertical-align:middle;margin:0 1px;"></span>
                                <span style="display:inline-block;width:3px;height:20px;background-color:#FFFFFF;border-radius:2px;vertical-align:middle;margin:0 1px;"></span>
                                <span style="display:inline-block;width:3px;height:14px;background-color:#FFFFFF;border-radius:2px;vertical-align:middle;margin:0 1px;"></span>
                                <span style="display:inline-block;width:3px;height:9px;background-color:#FFFFFF;border-radius:2px;vertical-align:middle;margin:0 1px;"></span>
                              </div>
                              <div style="width:22px;height:3px;background-color:#F59E0B;border-radius:3px;margin:3px auto 0 auto;"></div>
                            </div>
                          </td>
                          <!-- Wordmark with Golden-Amber dot -->
                          <td valign="middle">
                            <span style="font-size:23px;font-weight:800;color:#FFFFFF;letter-spacing:-0.03em;line-height:1;">
                              Switchboard<span style="color:#F59E0B;">.</span>
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>

                    <!-- Right Security Pill -->
                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:5px 11px;border-radius:999px;background-color:rgba(255,255,255,0.08);border:1px solid rgba(165,180,252,0.22);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;font-weight:600;color:#C4C0FF;letter-spacing:0.04em;">
                        &#9679; MAGIC LINK AUTH
                      </span>
                    </td>
                  </tr>
                </table>

                <!-- Hero Title & Subtitle -->
                <h1 style="margin:24px 0 8px 0;font-size:26px;line-height:1.25;font-weight:700;color:#FFFFFF;letter-spacing:-0.02em;">
                  Your front desk is ready.
                </h1>
                <p style="margin:0;font-size:14px;line-height:1.55;color:#CBD5E1;">
                  Authenticate with one click to manage your WhatsApp &amp; web chat receptionist, 15-minute slot holds, and verified Kora deposits.
                </p>
              </td>
            </tr>

            <!-- Main Content Body -->
            <tr>
              <td style="padding:32px 32px 24px 32px;">
                <!-- Target Account Pill -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:22px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;">
                  <tr>
                    <td style="padding:12px 16px;">
                      <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748B;">
                        Authenticating Workspace Account
                      </p>
                      <p style="margin:3px 0 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:14px;font-weight:600;color:#0C1233;">
                        ${safeEmail}
                      </p>
                    </td>
                    <td align="right" style="padding:12px 16px;">
                      <span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:#ECFDF5;border:1px solid rgba(16,185,129,0.28);font-size:11px;font-weight:600;color:#059669;">
                        Verified Request
                      </span>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 22px 0;font-size:15px;line-height:1.65;color:#334155;">
                  Tap the button below to securely sign in and launch your Switchboard workspace. No password required.
                </p>

                <!-- Primary CTA Button -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px 0;">
                  <tr>
                    <td align="center" style="border-radius:14px;background:linear-gradient(90deg,#181F63 0%,#493CCE 50%,#6258E8 100%);box-shadow:0 8px 20px -4px rgba(73,60,206,0.38);">
                      <a href="${safeVerifyUrl}" target="_blank" style="display:block;padding:16px 28px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:14px;letter-spacing:-0.01em;">
                        Sign in to Switchboard &rarr;
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Signature Hold-Band Style 15-Minute Expiry Notice -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px 0;background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="height:4px;background:linear-gradient(90deg,#F59E0B 0%,#FBBF24 70%,#FEF3C7 100%);font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td valign="top">
                            <p style="margin:0;font-size:13px;font-weight:700;color:#92400E;">
                              &#9201; Single-use link &middot; Expires in 15 minutes
                            </p>
                            <p style="margin:4px 0 0 0;font-size:12px;line-height:1.5;color:#78350F;">
                              Issued at <strong>${escapeHtml(formattedTimeWat)} WAT</strong> for <strong>${safeHost}</strong>. For your security, this token is invalidated immediately after use.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- 3-Column Booking Engine Capability Strip -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px 0;border-top:1px solid #F1F5F9;border-bottom:1px solid #F1F5F9;padding:16px 0;">
                  <tr>
                    <td width="33%" valign="top" style="padding-right:8px;">
                      <p style="margin:0;font-size:11px;font-weight:700;color:#493CCE;text-transform:uppercase;letter-spacing:0.04em;">
                        01 &middot; Channels
                      </p>
                      <p style="margin:4px 0 0 0;font-size:12px;line-height:1.4;color:#475569;font-weight:500;">
                        WhatsApp, Web Chat &amp; <code style="font-size:11px;color:#0C1233;">/b/[slug]</code>
                      </p>
                    </td>
                    <td width="33%" valign="top" style="padding:0 4px;">
                      <p style="margin:0;font-size:11px;font-weight:700;color:#D97706;text-transform:uppercase;letter-spacing:0.04em;">
                        02 &middot; Slot Holds
                      </p>
                      <p style="margin:4px 0 0 0;font-size:12px;line-height:1.4;color:#475569;font-weight:500;">
                        15-min lock &middot; Zero double-bookings
                      </p>
                    </td>
                    <td width="34%" valign="top" style="padding-left:8px;">
                      <p style="margin:0;font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.04em;">
                        03 &middot; Kora Deposits
                      </p>
                      <p style="margin:4px 0 0 0;font-size:12px;line-height:1.4;color:#475569;font-weight:500;">
                        Webhook + re-query verified in &#8358;
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Fallback Copy Link Box -->
                <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;color:#64748B;">
                  Button not opening? Copy and paste this verification URL into your browser:
                </p>
                <div style="padding:12px 14px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;line-height:1.5;word-break:break-all;color:#3B32B8;margin-bottom:8px;">
                  <a href="${safeVerifyUrl}" style="color:#3B32B8;text-decoration:underline;">${safeVerifyUrl}</a>
                </div>
                <p style="margin:0;font-size:11px;color:#94A3B8;">
                  Or use direct session callback: <a href="${safeDirectUrl}" style="color:#64748B;text-decoration:underline;">Direct Sign-In Link</a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color:#F8FAFC;border-top:1px solid #E2E8F0;padding:20px 32px;text-align:left;">
                <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#64748B;">
                  <strong>Didn&rsquo;t request this email?</strong> You can safely ignore it. Only someone with access to <strong>${safeEmail}</strong> can use this link.
                </p>
                <p style="margin:0;font-size:11px;color:#94A3B8;">
                  &copy; 2026 Switchboard &middot; AI Booking Front Desk for Salons &amp; Barbers &middot; <a href="https://switchboard-bm.vercel.app" style="color:#493CCE;text-decoration:none;font-weight:600;">switchboard-bm.vercel.app</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
