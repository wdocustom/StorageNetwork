import { NextRequest, NextResponse } from "next/server";
import { unsubscribeFromAffiliateInvites } from "@/app/actions/affiliate-invites";

// ═══════════════════════════════════════════════════════════════════════════
// Unsubscribe Handler — /api/unsubscribe-affiliate-invite?token=<token>
//
// CAN-SPAM-compliant one-click unsubscribe. The link in every affiliate
// cold-invite email points here.
//
// Two methods, mirroring the existing /api/unsubscribe-digest pattern:
//   GET  — renders a confirmation page with a real POST button. Prevents
//          accidental unsubscribes from email-client link prefetchers
//          (Gmail and Outlook both probe links when previewing).
//   POST — actually adds to cold_email_suppressions + flips the invite
//          row to status='unsubscribed'. Returns a "you're unsubscribed"
//          page.
//
// Idempotent: a second POST is a no-op (suppressions table has a unique
// constraint on email).
// ═══════════════════════════════════════════════════════════════════════════

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Storage Network</title>
<style>
  body { margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#0f172a; color:#e2e8f0; }
  .wrap { max-width: 480px; margin: 64px auto; padding: 32px; background:#1e293b; border-radius:16px; border: 1px solid #334155; }
  h1 { color:#facc15; font-size: 22px; margin: 0 0 12px; }
  p { color:#94a3b8; line-height:1.7; font-size:15px; margin:0 0 16px; }
  button, .btn {
    display:inline-block; padding:12px 24px; border-radius:10px;
    background:#facc15; color:#0f172a; font-weight:700; font-size:14px;
    border:0; cursor:pointer; text-decoration:none;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .secondary { color:#64748b; font-size:13px; text-decoration: underline; }
  form { margin: 0; }
</style>
</head>
<body>
  <div class="wrap">
    ${body}
  </div>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!token) {
    return new NextResponse(
      htmlPage(
        "Unsubscribe",
        `<h1>Missing token</h1>
         <p>This unsubscribe link is incomplete or expired.</p>`
      ),
      { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 }
    );
  }

  // Render confirmation page (GET shouldn't mutate — protects against link
  // prefetching by email clients accidentally unsubscribing the user).
  const body = `
    <h1>Don't want these invites?</h1>
    <p>Click the button below to opt out. No installer on Storage Network will
       send you a referral invite again.</p>
    <form method="POST">
      <input type="hidden" name="token" value="${escape(token)}">
      <button type="submit">Confirm Unsubscribe</button>
    </form>
    <p style="margin-top:24px;"><a class="secondary" href="/">Cancel</a></p>
  `;
  return new NextResponse(htmlPage("Unsubscribe", body), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  // Token can come from the form body OR the query string. Accept both so
  // the URL-from-email flow + form-submission flow both work.
  const fromQuery = request.nextUrl.searchParams.get("token");
  let token = fromQuery || "";
  if (!token) {
    try {
      const form = await request.formData();
      token = (form.get("token") as string | null) || "";
    } catch {
      // No body — fall through with empty token, handled below.
    }
  }

  if (!token) {
    return new NextResponse(
      htmlPage(
        "Unsubscribe",
        `<h1>Missing token</h1><p>This unsubscribe link is incomplete.</p>`
      ),
      { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 }
    );
  }

  const res = await unsubscribeFromAffiliateInvites(token);
  if (!res.success) {
    return new NextResponse(
      htmlPage(
        "Unsubscribe",
        `<h1>Hmm.</h1>
         <p>${escape(res.error || "Something went wrong.")} Try again or email
         <a class="secondary" href="mailto:support@storage-network.app">support@storage-network.app</a>.</p>`
      ),
      { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 }
    );
  }

  return new NextResponse(
    htmlPage(
      "Unsubscribed",
      `<h1>You're out.</h1>
       <p>${escape(res.prospectEmail || "Your email")} won't receive any more affiliate
       invites from Storage Network. If this was a mistake, just reply to the
       original email and we'll undo it.</p>
       <p style="margin-top:32px;"><a class="btn" href="/">Back to homepage</a></p>`
    ),
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
