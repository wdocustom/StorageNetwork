// ═══════════════════════════════════════════════════════════════════════════
// Signed "request a new quote" links for returning customers
//
// A link names the customer's earlier job (lead id) plus an HMAC of it, so
// it can't be guessed or pointed at someone else's job, and needs no stored
// token. It's put in the receipt email, the review page + review-request
// email, and the rack inventory email + page.
//
// Secret: REQUEST_LINK_SECRET if set, else the Supabase service-role key
// (always present server-side). Rotating whichever is in use invalidates
// outstanding links — acceptable for a convenience link.
//
// Not a "use server" module: signing must never be callable from a browser.
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from "crypto";
import { getAppUrl } from "@/lib/url-helper";

export type RequestOrigin = "receipt" | "review" | "rack" | "other";
export const REQUEST_ORIGINS: RequestOrigin[] = ["receipt", "review", "rack", "other"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string {
  const s = process.env.REQUEST_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("No secret configured for request links.");
  return s;
}

function sign(leadId: string): string {
  return createHmac("sha256", secret()).update(`quote-request:${leadId}`).digest("base64url").slice(0, 24);
}

/** Token for a lead: `<leadId>.<signature>`. */
export function signRequestToken(leadId: string): string {
  return `${leadId}.${sign(leadId)}`;
}

/** The lead id a token names, or null if it's malformed or forged. */
export function verifyRequestToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [leadId, sig] = token.split(".");
  if (!leadId || !sig || !UUID_RE.test(leadId)) return null;
  const expected = Buffer.from(sign(leadId));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return leadId;
}

/**
 * Full URL of the request page for a lead — or undefined if no signing
 * secret is configured, so a missing secret drops the link instead of
 * breaking the email it's in.
 */
export function requestQuoteUrl(leadId: string, origin: RequestOrigin): string | undefined {
  try {
    return `${getAppUrl()}/request/${signRequestToken(leadId)}?via=${origin}`;
  } catch {
    return undefined;
  }
}
