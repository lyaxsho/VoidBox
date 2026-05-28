import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || 'VoidBox <noreply@voidbox.app>';
const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL}/verify-email?token=${token}`;

  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — verification link for ${to}: ${link}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Verify your VoidBox email',
    html: verifyEmailHtml(link, to),
  });
}

export async function sendMagicLinkEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL}/magic-link?token=${token}`;

  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — magic link for ${to}: ${link}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Your VoidBox sign-in link',
    html: magicLinkEmailHtml(link, to),
  });
}

function magicLinkEmailHtml(link: string, email: string): string {
  return verifyEmailHtml(link, email)
    .replace('Verify your email — VoidBox', 'Sign in to VoidBox')
    .replace(/Verify email →|Verify your email/g, 'Sign in →')
    .replace(/Verify your address to start using/g, 'Click the button below to sign in to')
    .replace(/Verify email/g, 'Sign in');
}

function verifyEmailHtml(link: string, email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email — VoidBox</title>
  <style>
    /* ── Dark mode overrides ── */
    @media (prefers-color-scheme: dark) {
      .bg-root    { background-color: #0a0a0a !important; }
      .brand      { color: #ffffff !important; }
      .card       { background-color: #111111 !important; border-color: #222222 !important; }
      .heading    { color: #ffffff !important; }
      .body-text  { color: #888888 !important; }
      .em-email   { color: #cccccc !important; }
      .btn        { background-color: #ffffff !important; color: #000000 !important; }
      .divider    { border-color: #222222 !important; }
      .link-label { color: #555555 !important; }
      .link-url   { color: #666666 !important; }
      .footer     { color: #444444 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" class="bg-root"
         style="background:#f2f2f2;padding:48px 16px;font-family:'Inter',Arial,sans-serif;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

          <!-- Brand -->
          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <span class="brand"
                    style="font-family:'Georgia','Times New Roman',serif;font-size:26px;
                           font-weight:400;color:#0a0a0a;letter-spacing:-0.5px;">
                VoidBox
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="card"
                style="background:#ffffff;border:1px solid #e2e2e2;border-radius:16px;
                       padding:40px 40px 36px;">

              <!-- Heading -->
              <p class="heading"
                 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#111111;
                        font-family:'Georgia','Times New Roman',serif;line-height:1.3;">
                Confirm your email
              </p>

              <!-- Body -->
              <p class="body-text"
                 style="margin:0 0 30px;font-size:14px;color:#666666;line-height:1.75;">
                Click the button below to verify
                <strong class="em-email" style="color:#222222;">${email}</strong>
                and activate your VoidBox account.
                This link expires in&nbsp;24&nbsp;hours.
              </p>

              <!-- CTA button -->
              <a href="${link}" class="btn"
                 style="display:inline-block;background:#0a0a0a;color:#ffffff;
                        font-size:14px;font-weight:700;text-decoration:none;
                        padding:14px 36px;border-radius:12px;letter-spacing:-0.1px;">
                Verify email &rarr;
              </a>

              <!-- Divider -->
              <hr class="divider"
                  style="margin:32px 0 24px;border:none;border-top:1px solid #ebebeb;" />

              <!-- Fallback link -->
              <p class="link-label"
                 style="margin:0 0 6px;font-size:11px;color:#aaaaaa;letter-spacing:0.3px;
                        text-transform:uppercase;">
                Or copy this link
              </p>
              <a href="${link}" class="link-url"
                 style="font-size:12px;color:#999999;word-break:break-all;
                        text-decoration:underline;line-height:1.6;">
                ${link}
              </a>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p class="footer"
                 style="margin:0;font-size:11px;color:#b0b0b0;line-height:1.7;">
                If you didn't create a VoidBox account, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
