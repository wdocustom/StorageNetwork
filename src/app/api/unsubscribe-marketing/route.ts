import { NextRequest, NextResponse } from "next/server";
import { optOutBySendId } from "@/lib/server/repeat-order-campaign";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════
// /api/unsubscribe-marketing?token=<marketing_email_sends.id>
//
// Opts the customer out of PROMOTIONAL platform email only. It writes to
// customer_marketing_optouts, which is read by campaign senders and nothing
// else: receipts, scheduling, tracking and balance emails for any order —
// past or future — are transactional and never consult it.
//
// GET renders a confirm page (email scanners/prefetchers GET every link, so a
// GET must never unsubscribe). POST performs it — also the target of the
// RFC 8058 one-click List-Unsubscribe-Post header.
// ═══════════════════════════════════════════════════════════════════════════

const HEADERS = { "content-type": "text/html; charset=utf-8" };

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Storage Network</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#000;color:#e5e5e5}
  .wrap{max-width:480px;margin:64px auto;padding:32px;background:#111;border-radius:16px;border:1px solid #222}
  h1{color:#facc15;font-size:22px;margin:0 0 12px}
  p{color:#a3a3a3;line-height:1.7;font-size:15px;margin:0 0 16px}
  button,.btn{display:inline-block;padding:12px 24px;border-radius:10px;background:#facc15;color:#000;font-weight:700;font-size:14px;border:0;cursor:pointer;text-decoration:none}
  a.secondary{color:#737373;font-size:13px}
</style></head><body><div class="wrap">${body}</div></body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!token) {
    return new NextResponse(page("Unsubscribe", `<h1>Missing link</h1><p>This unsubscribe link is incomplete.</p>`), {
      status: 400,
      headers: HEADERS,
    });
  }
  return new NextResponse(
    page(
      "Unsubscribe",
      `<h1>Stop promotional emails?</h1>
       <p>You&rsquo;ll stop getting promotional offers from Storage Network. Emails
       about your orders &mdash; receipts, scheduling, install tracking &mdash;
       are not affected, and you can still order anytime.</p>
       <form method="POST" action="/api/unsubscribe-marketing?token=${encodeURIComponent(token)}">
         <button type="submit">Unsubscribe from promotions</button>
       </form>
       <p style="margin-top:24px;"><a class="secondary" href="/">Cancel</a></p>`
    ),
    { headers: HEADERS }
  );
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const res = await optOutBySendId(token);
  if (!res.success) {
    return new NextResponse(
      page(
        "Unsubscribe",
        `<h1>Hmm.</h1><p>${esc(res.error || "Something went wrong.")} Email
         <a class="secondary" href="mailto:support@storage-network.app">support@storage-network.app</a>
         and we&rsquo;ll take care of it.</p>`
      ),
      { status: 400, headers: HEADERS }
    );
  }
  return new NextResponse(
    page(
      "Unsubscribed",
      `<h1>You&rsquo;re unsubscribed.</h1>
       <p>${esc(res.email || "Your email")} won&rsquo;t get promotional emails from
       Storage Network anymore. Order updates, receipts and tracking emails
       for your orders will keep coming as usual.</p>`
    ),
    { headers: HEADERS }
  );
}
