"use server";

import { headers } from "next/headers";
import { getServiceClient } from "@/lib/supabase-server";
import { getAppUrl } from "@/lib/url-helper";
import {
  sendContractorAgreementInvite,
  sendContractorAgreementSignedReceipt,
} from "@/lib/emails/contractorAgreementTemplates";

// ═══════════════════════════════════════════════════════════════════════════
// Contractor agreement signing — server actions
//
// Three entry points:
//   1. getContractorAgreementByToken — public read for /contracts/sign/[token]
//   2. acceptContractorAgreement     — public write; records the typed signature
//   3. sendPendingContractorAgreements — cron-callable; fires the invite email
//                                        for any row in 'pending_send' with
//                                        email_sent_at IS NULL
// ═══════════════════════════════════════════════════════════════════════════

export interface ContractorAgreementView {
  id: string;
  title: string;
  bodyMd: string;
  effectiveDate: string;
  contractorName: string;
  companySignerName: string;
  companySignedAt: string;
  contractorSignedAt: string | null;
  contractorTypedSignature: string | null;
  status: "pending_send" | "sent" | "signed" | "revoked";
}

// ─────────────────────────────────────────────────────────────────────────
// getContractorAgreementByToken — public read keyed on the signing token
// ─────────────────────────────────────────────────────────────────────────
export async function getContractorAgreementByToken(
  token: string
): Promise<{ success: boolean; agreement?: ContractorAgreementView; error?: string }> {
  if (!token || typeof token !== "string") {
    return { success: false, error: "Invalid signing link." };
  }
  // Basic UUID shape guard so we never run a wildcard query.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return { success: false, error: "Invalid signing link." };
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from("contractor_agreements")
    .select(
      "id, title, body_md, effective_date, contractor_name_snapshot, " +
      "company_signer_name, company_signed_at, contractor_signed_at, " +
      "contractor_typed_signature, status"
    )
    .eq("signature_token", token)
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: "Signing link not found or expired." };
  }

  // New table; Supabase-js generated types don't know its columns yet.
  // Cast explicitly through the selected shape.
  const row = data as unknown as {
    id: string;
    title: string;
    body_md: string;
    effective_date: string;
    contractor_name_snapshot: string;
    company_signer_name: string;
    company_signed_at: string;
    contractor_signed_at: string | null;
    contractor_typed_signature: string | null;
    status: ContractorAgreementView["status"];
  };

  return {
    success: true,
    agreement: {
      id: row.id,
      title: row.title,
      bodyMd: row.body_md,
      effectiveDate: row.effective_date,
      contractorName: row.contractor_name_snapshot,
      companySignerName: row.company_signer_name,
      companySignedAt: row.company_signed_at,
      contractorSignedAt: row.contractor_signed_at,
      contractorTypedSignature: row.contractor_typed_signature,
      status: row.status,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// acceptContractorAgreement — public write; records the typed signature
//
// Legal acceptance shape:
//   • The signer types their full name into a text input.
//   • We require a case-insensitive match against contractor_name_snapshot
//     (after trimming + collapsing whitespace) so a casual signer can't
//     accept on someone else's behalf.
//   • Capture IP + UA from request headers for the audit trail.
//   • Status flips to 'signed' on success; idempotent — second call returns
//     alreadySigned=true without overwriting.
// ─────────────────────────────────────────────────────────────────────────
export async function acceptContractorAgreement(input: {
  token: string;
  typedSignature: string;
}): Promise<{ success: boolean; alreadySigned?: boolean; error?: string }> {
  const token = (input.token ?? "").trim();
  const typed = (input.typedSignature ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return { success: false, error: "Invalid signing link." };
  }
  if (!typed) {
    return { success: false, error: "Please type your full name to sign." };
  }

  const db = getServiceClient();

  const { data: existingRaw } = await db
    .from("contractor_agreements")
    .select(
      "id, status, contractor_name_snapshot, contractor_email_snapshot, " +
      "title, contractor_signed_at"
    )
    .eq("signature_token", token)
    .maybeSingle();

  if (!existingRaw) {
    return { success: false, error: "Signing link not found." };
  }
  const existing = existingRaw as unknown as {
    id: string;
    status: "pending_send" | "sent" | "signed" | "revoked";
    contractor_name_snapshot: string;
    contractor_email_snapshot: string;
    title: string;
    contractor_signed_at: string | null;
  };

  if (existing.status === "revoked") {
    return { success: false, error: "This agreement has been revoked." };
  }
  if (existing.status === "signed" || existing.contractor_signed_at) {
    return { success: true, alreadySigned: true };
  }

  // Typed-name match — case-insensitive, collapse internal whitespace.
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const expected = normalize(existing.contractor_name_snapshot);
  if (normalize(typed) !== expected) {
    return {
      success: false,
      error:
        `The name you typed doesn't match the name on the agreement ` +
        `(${existing.contractor_name_snapshot}). Please type your full ` +
        `legal name exactly as it appears in the signature block.`,
    };
  }

  // Audit trail — IP + UA from request headers. Best-effort; the row still
  // signs even if proxies strip these.
  let signedIp: string | null = null;
  let signedUa: string | null = null;
  try {
    const h = headers();
    signedIp =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;
    signedUa = h.get("user-agent") || null;
  } catch {
    /* edge cases where headers() isn't accessible — skip the audit fields */
  }

  const signedAt = new Date().toISOString();

  // CAS update: only flip if not already signed. Prevents a race where two
  // tabs both POST the form.
  const { data: updated, error: updateErr } = await db
    .from("contractor_agreements")
    .update({
      status: "signed",
      contractor_signed_at: signedAt,
      contractor_typed_signature: typed,
      contractor_signed_ip: signedIp,
      contractor_signed_user_agent: signedUa,
      updated_at: signedAt,
    })
    .eq("signature_token", token)
    .is("contractor_signed_at", null)
    .select("id")
    .maybeSingle();

  if (updateErr) {
    console.error("[ContractorAgreement] DB update failed:", updateErr.message);
    return { success: false, error: "Could not record signature. Please try again." };
  }

  if (!updated) {
    // Lost the race — another writer already flipped it. Treat as success.
    return { success: true, alreadySigned: true };
  }

  // Fire-and-forget receipt email so the signer has proof in their inbox.
  // Failure is non-fatal — the signature is already recorded.
  (async () => {
    try {
      await sendContractorAgreementSignedReceipt(
        existing.contractor_email_snapshot,
        {
          contractorName: existing.contractor_name_snapshot,
          agreementTitle: existing.title,
          signedAt: formatTimestampForReceipt(signedAt),
          typedSignature: typed,
        }
      );
    } catch (err) {
      console.error("[ContractorAgreement] Receipt email failed:", err);
    }
  })();

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────
// sendPendingContractorAgreements — cron entry point
//
// Walks every row in 'pending_send' with email_sent_at IS NULL and fires
// the invite email. Mirrors the announcement-cron shape (same retry on
// Resend rate-limits, same 600ms pacing between sends). Marks success
// with status='sent' + email_sent_at; on failure logs last_email_error
// and bumps email_send_attempts so an operator can spot stuck rows.
// ─────────────────────────────────────────────────────────────────────────
export interface SendPendingContractorAgreementsResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}

export async function sendPendingContractorAgreements(): Promise<SendPendingContractorAgreementsResult> {
  const result: SendPendingContractorAgreementsResult = {
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: [],
  };

  const db = getServiceClient();
  const baseUrl = getAppUrl();

  const { data: rowsRaw, error } = await db
    .from("contractor_agreements")
    .select(
      "id, signature_token, title, contractor_name_snapshot, " +
      "contractor_email_snapshot, company_signer_name, effective_date, " +
      "email_send_attempts"
    )
    .eq("status", "pending_send")
    .is("email_sent_at", null)
    .limit(50);

  if (error) {
    console.error("[ContractorAgreement] Query failed:", error.message);
    result.errors.push(`Query failed: ${error.message}`);
    return result;
  }

  const rows = (rowsRaw ?? []) as unknown as Array<{
    id: string;
    signature_token: string;
    title: string;
    contractor_name_snapshot: string;
    contractor_email_snapshot: string | null;
    company_signer_name: string;
    effective_date: string;
    email_send_attempts: number;
  }>;

  if (rows.length === 0) {
    console.log("[ContractorAgreement] No pending agreements to send.");
    return result;
  }

  console.log(`[ContractorAgreement] Processing ${rows.length} pending agreement(s)…`);

  for (const row of rows) {
    result.processed++;

    const email = row.contractor_email_snapshot?.trim();
    if (!email) {
      result.skipped++;
      result.errors.push(`${row.id}: missing contractor email`);
      continue;
    }

    const signUrl = `${baseUrl}/contracts/sign/${row.signature_token}`;
    const effectiveDate = formatDate(row.effective_date);

    let sent = false;
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const emailResult = await sendContractorAgreementInvite(email, {
          contractorName: row.contractor_name_snapshot,
          agreementTitle: row.title,
          companySignerName: row.company_signer_name,
          effectiveDate,
          signUrl,
        });

        if (emailResult.success) {
          sent = true;
          break;
        }

        lastError = emailResult.error || "Unknown error";
        if (lastError.includes("Too many requests") && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        break;
      }
    }

    const nextAttempts = row.email_send_attempts + 1;
    if (sent) {
      await db
        .from("contractor_agreements")
        .update({
          email_sent_at: new Date().toISOString(),
          status: "sent",
          email_send_attempts: nextAttempts,
          last_email_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      result.sent++;
      console.log(
        `[ContractorAgreement] Sent ${row.id} to ${email} (${row.contractor_name_snapshot})`
      );
    } else {
      await db
        .from("contractor_agreements")
        .update({
          email_send_attempts: nextAttempts,
          last_email_error: lastError,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      result.errors.push(`${email}: ${lastError}`);
      console.error(
        `[ContractorAgreement] Failed ${row.id} → ${email}: ${lastError}`
      );
    }

    // Pace ourselves under Resend's per-second cap — matches the
    // announcement cron pattern.
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log("[ContractorAgreement] Complete:", result);
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  // "2026-05-15" → "May 15, 2026". Falls back to the raw value on any
  // parse weirdness so the email never breaks on a malformed effective_date.
  try {
    const d = new Date(`${isoDate}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return isoDate;
  }
}

function formatTimestampForReceipt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}
