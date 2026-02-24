// ═══════════════════════════════════════════════════════════════════════════
// Supabase Auth Email Templates — Dark Industrial Theme
//
// These templates should be pasted into the Supabase Dashboard:
//   Authentication → Email Templates
//
// Supabase uses {{ .Variable }} placeholders:
//   {{ .ConfirmationURL }}  — Email confirmation link
//   {{ .Token }}            — OTP token (if using token-based)
//   {{ .SiteURL }}          — Your app URL
//   {{ .RedirectTo }}       — Redirect URL
//
// To apply: Go to Supabase Dashboard → Authentication → Email Templates
// and paste the corresponding template for each email type.
// ═══════════════════════════════════════════════════════════════════════════

const LOGO_URL = "https://storage-network.app/landing_page_logo.png";

function supabaseEmailShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#0f172a;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background-color:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%);padding:36px 32px;text-align:center;border-bottom:1px solid #334155;">
        <img src="${LOGO_URL}" alt="Storage Network" style="max-width:120px;max-height:120px;width:auto;height:auto;margin-bottom:16px;" />
        <h1 style="margin:0;color:#facc15;font-size:24px;font-weight:800;letter-spacing:-0.3px;">${title}</h1>
        <div style="margin:12px auto 0;width:60px;height:2px;background:linear-gradient(to right,#facc15,#f59e0b);border-radius:1px;"></div>
      </div>
      <div style="padding:32px;">
        ${body}
      </div>
      <div style="border-top:1px solid #334155;padding:20px 32px;text-align:center;">
        <p style="margin:0;color:#475569;font-size:11px;">
          Sent by <a href="{{ .SiteURL }}" style="color:#94a3b8;text-decoration:none;font-weight:600;">Storage Network</a> &bull; storage-network.app
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Confirm Signup ─────────────────────────────────────────────────────────
export const CONFIRM_SIGNUP_TEMPLATE = supabaseEmailShell(
  "Confirm Your Email",
  `
  <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Welcome to Storage Network!</p>
  <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
    Tap the button below to verify your email address and activate your account.
  </p>
  <div style="text-align:center;margin-bottom:24px;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
      Verify Email
    </a>
  </div>
  <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
    If you didn&rsquo;t create an account, you can safely ignore this email.
  </p>
  `
);

// ── Password Reset ─────────────────────────────────────────────────────────
export const RESET_PASSWORD_TEMPLATE = supabaseEmailShell(
  "Reset Your Password",
  `
  <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Password reset requested.</p>
  <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
    Tap the button below to choose a new password for your Storage Network account.
    This link expires in 24 hours.
  </p>
  <div style="text-align:center;margin-bottom:24px;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
      Reset Password
    </a>
  </div>
  <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
    If you didn&rsquo;t request this, you can safely ignore this email.
  </p>
  `
);

// ── Magic Link ─────────────────────────────────────────────────────────────
export const MAGIC_LINK_TEMPLATE = supabaseEmailShell(
  "Your Sign-In Link",
  `
  <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Sign in to Storage Network</p>
  <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
    Tap the button below to sign in. This link expires in 10 minutes.
  </p>
  <div style="text-align:center;margin-bottom:24px;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
      Sign In
    </a>
  </div>
  <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
    If you didn&rsquo;t request this, you can safely ignore this email.
  </p>
  `
);

// ── Email Change Confirmation ──────────────────────────────────────────────
export const EMAIL_CHANGE_TEMPLATE = supabaseEmailShell(
  "Confirm Email Change",
  `
  <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Email change requested.</p>
  <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
    Tap the button below to confirm changing your email address on Storage Network.
  </p>
  <div style="text-align:center;margin-bottom:24px;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
      Confirm New Email
    </a>
  </div>
  <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
    If you didn&rsquo;t request this change, please secure your account immediately.
  </p>
  `
);
