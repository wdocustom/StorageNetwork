import type { SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Duplicate-lead guard
//
// WHY THIS EXISTS
// ─────────────────────────────────────────────────────────────────────────
// Every "Book" / "Send quote" used to insert a brand-new lead. A customer
// who went back and resubmitted (or an installer who double-tapped Send)
// left two pending leads with the identical build. Each one then got its
// own customer emails — the nightly "your saved build is ready" reminder
// went out twice, and even went to customers who had already paid on the
// other copy (e.g. leads ce7ffd9d / 70c00a43, cdb58887 / fb2ab8ae).
//
// Callers check here first and reuse the existing lead instead.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stable fingerprint of a build: the units (key order normalized — JSONB
 * doesn't preserve it) plus the total. Same fingerprint = same quote.
 */
export function buildFingerprint(quoteData: unknown, total: number | null | undefined): string {
  return `${stableStringify(quoteData ?? [])}|${Math.round(Number(total || 0) * 100)}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Escape LIKE wildcards so an email matches literally under ILIKE. */
export function ilikeLiteral(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * The most recent lead for this customer + installer with the identical
 * build and one of `statuses`, created within `withinHours` — or null.
 */
export async function findDuplicateLead(
  db: SupabaseClient,
  params: {
    email: string | null | undefined;
    installerId: string | null | undefined;
    quoteData: unknown;
    total: number | null | undefined;
    statuses: string[];
    withinHours: number;
  }
): Promise<{ id: string; created_at: string } | null> {
  const email = params.email?.trim();
  if (!email || !params.installerId) return null;

  const since = new Date(Date.now() - params.withinHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("leads")
    .select("id, created_at, quote_data, estimated_price")
    .ilike("customer_email", ilikeLiteral(email))
    .eq("installer_id", params.installerId)
    .in("status", params.statuses)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) {
    if (error) console.error("[LeadDedupe] lookup failed (allowing new lead):", error.message);
    return null;
  }

  const want = buildFingerprint(params.quoteData, params.total);
  const match = data.find((l) => buildFingerprint(l.quote_data, l.estimated_price as number) === want);
  return match ? { id: match.id as string, created_at: match.created_at as string } : null;
}

/**
 * Customers (lower-cased emails) who have committed to a job with this
 * installer — paid a deposit, or the job is paid/completed. Once that's
 * true, "come back and finish your order" emails for their other pending
 * leads with the same installer must stop.
 */
export async function bookedCustomerEmails(
  db: SupabaseClient,
  installerId: string,
  emails: string[]
): Promise<Set<string>> {
  const wanted = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (wanted.length === 0) return new Set();
  const booked = new Set<string>();
  // ILIKE per email (stored case varies); batches stay small — callers pass
  // one installer's pending customers.
  for (const email of wanted) {
    const { data, error } = await db
      .from("leads")
      .select("id")
      .eq("installer_id", installerId)
      .ilike("customer_email", ilikeLiteral(email))
      .or("deposit_paid.eq.true,status.in.(paid,completed)")
      .limit(1);
    if (error) {
      console.error("[LeadDedupe] booked lookup failed:", error.message);
      continue;
    }
    if (data && data.length > 0) booked.add(email);
  }
  return booked;
}
