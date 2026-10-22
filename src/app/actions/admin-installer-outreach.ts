"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { getChatModel, hasChatProvider, generateTextWithFallback } from "@/lib/ai-provider";
import { sendTransactionalEmail } from "@/lib/emails/core";
import { masterEmailLayout } from "@/lib/emails/components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import { slugify } from "@/lib/utils";
import {
  applyMergeTags,
  escapeHtml,
  outreachTextToHtml,
  unknownMergeTags,
} from "@/lib/installer-outreach";

// ═══════════════════════════════════════════════════════════════════════════
// Admin Installer Outreach — Partner Portal
//
// Lets an admin re-engage installers who aren't active (expired trials,
// never logged in, free plan) with a personal email, drafted freehand or by
// Gemini, sent to one installer or many via {{merge_tags}}. Also lets the
// admin comp Pro (no Stripe, no trial clock — free until toggled off) or
// extend a Pro trial.
//
// Every action re-verifies the caller from the session cookie; no caller id
// is trusted from the client.
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

const MAX_RECIPIENTS_PER_CALL = 10; // client chunks larger sends for progress + timeouts
const SEND_DELAY_MS = 600; // stay under Resend's per-second rate limit
const MAX_TRIAL_EXTENSION_DAYS = 365;

async function requireAdmin(): Promise<{ id: string; email: string | null; firstName: string | null }> {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Not authenticated");
  const { data } = await db()
    .from("profiles")
    .select("is_admin, email, first_name")
    .eq("id", user.id)
    .single();
  if (!data?.is_admin) throw new Error("Admin access required");
  return { id: user.id, email: data.email ?? user.email ?? null, firstName: data.first_name ?? null };
}

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// ── Per-installer outreach / comp state ─────────────────────────────────────

export interface InstallerOutreachMeta {
  pro_comped: boolean;
  pro_comped_at: string | null;
  last_outreach_at: string | null;
  outreach_count: number;
}

/**
 * Comp + outreach state for every installer, keyed by id. Kept separate from
 * getAdminPlatformUsers so the user list still loads if migration 145 hasn't
 * been applied yet — this just comes back empty.
 */
export async function getInstallerOutreachMeta(): Promise<
  { success: true; meta: Record<string, InstallerOutreachMeta> } | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const meta: Record<string, InstallerOutreachMeta> = {};
    const blank = (): InstallerOutreachMeta => ({
      pro_comped: false,
      pro_comped_at: null,
      last_outreach_at: null,
      outreach_count: 0,
    });

    const [{ data: comped, error: compErr }, { data: sends, error: sendErr }] = await Promise.all([
      db().from("profiles").select("id, pro_comped_at").eq("pro_comped", true),
      db().from("installer_outreach_emails").select("installer_id, sent_at").order("sent_at", { ascending: false }),
    ]);
    if (compErr) console.warn("[Outreach] comp lookup failed (migration 145 applied?):", compErr.message);
    if (sendErr) console.warn("[Outreach] send log lookup failed (migration 145 applied?):", sendErr.message);

    for (const row of comped ?? []) {
      meta[row.id] = { ...blank(), pro_comped: true, pro_comped_at: row.pro_comped_at ?? null };
    }
    for (const row of sends ?? []) {
      const m = (meta[row.installer_id] ??= blank());
      m.outreach_count++;
      if (!m.last_outreach_at) m.last_outreach_at = row.sent_at; // rows are newest-first
    }
    return { success: true, meta };
  } catch (err) {
    return { success: false, error: errMsg(err, "Failed to load outreach state.") };
  }
}

// ── Gemini draft generator ──────────────────────────────────────────────────

interface InstallerContextRow {
  id: string;
  first_name: string | null;
  business_name: string | null;
  city: string | null;
  state: string | null;
  is_pro: boolean | null;
  pro_trial_ends_at: string | null;
  stripe_subscription_id: string | null;
  last_login_at: string | null;
  created_at: string;
  stripe_account_id: string | null;
}

function describeStatus(p: InstallerContextRow): string {
  const parts: string[] = [];
  const trialEnd = p.pro_trial_ends_at ? new Date(p.pro_trial_ends_at) : null;
  if (p.stripe_subscription_id) parts.push("paying Pro subscriber");
  else if (trialEnd && trialEnd > new Date()) parts.push(`on a Pro trial ending ${trialEnd.toDateString()}`);
  else if (trialEnd) parts.push("Pro trial expired, never subscribed");
  else if (p.is_pro) parts.push("Pro (no subscription)");
  else parts.push("Free plan / Pro access ended");
  parts.push(p.last_login_at ? `last logged in ${new Date(p.last_login_at).toDateString()}` : "has never logged in");
  parts.push(`joined ${new Date(p.created_at).toDateString()}`);
  if (!p.stripe_account_id) parts.push("hasn't connected Stripe payouts");
  return parts.join("; ");
}

const DRAFT_SYSTEM = `You write short, personal outreach emails from the founder of Storage Network to garage-storage installers who signed up for the platform but aren't actively using it.

About Storage Network (storage-network.app): a platform for independent installers who build heavy-duty garage tote racks and storage. Installers get a branded booking link with a Custom 3D Designer homeowners use to design and pay a deposit online, Automated Cut Lists for every build, the AI Asset Forge for marketing graphics, auto-routed leads from the network, and instant Stripe payouts. Pro unlocks the branded page (their logo + custom pricing).

Rules:
- Sound like a real person writing one-to-one: warm, direct, plain language. No hype, no emojis, no hashtags, no bullet-point walls.
- Keep the body under 170 words unless the admin's instructions ask otherwise.
- ALWAYS personalise with merge tags, never with real names: {{first_name}} for the person, {{business_name}} for their company, {{city}} for their city. The same draft may be sent to many installers. Use {{first_name}} in the greeting.
- Do not invent prices, discounts, deadlines or features beyond what the admin's instructions say.
- Do not include a sign-off, signature or unsubscribe text — those are added automatically. End on the call to action.
- Plain text only. Separate paragraphs with a blank line.

Respond with ONLY a JSON object: {"subject": "...", "body": "..."}. The subject may use merge tags and must be under 70 characters.`;

function parseDraft(text: string): { subject: string; body: string } | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { subject?: unknown; body?: unknown };
    if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") return null;
    return { subject: parsed.subject.trim(), body: parsed.body.trim() };
  } catch {
    return null;
  }
}

export async function generateOutreachDraft(input: {
  instructions: string;
  recipientIds: string[];
  currentSubject?: string;
  currentBody?: string;
}): Promise<{ success: true; subject: string; body: string } | { success: false; error: string }> {
  try {
    await requireAdmin();
    if (!hasChatProvider()) return { success: false, error: "AI isn't configured (GOOGLE_GENERATIVE_AI_API_KEY)." };

    const instructions = input.instructions.trim().slice(0, 2000);
    const ids = [...new Set(input.recipientIds)].slice(0, 200);

    let audience = "";
    if (ids.length > 0) {
      const { data } = await db()
        .from("profiles")
        .select("id, first_name, business_name, city, state, is_pro, pro_trial_ends_at, stripe_subscription_id, last_login_at, created_at, stripe_account_id")
        .in("id", ids);
      const rows = (data ?? []) as InstallerContextRow[];
      if (rows.length === 1) {
        const p = rows[0];
        audience = `Recipient (use merge tags, not these literal values): ${p.business_name || "installer"}${p.city ? ` in ${[p.city, p.state].filter(Boolean).join(", ")}` : ""}. Status: ${describeStatus(p)}.`;
      } else if (rows.length > 1) {
        const counts = new Map<string, number>();
        for (const p of rows) {
          const key = describeStatus(p).split(";")[0];
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const neverLoggedIn = rows.filter((p) => !p.last_login_at).length;
        audience = `This email goes to ${rows.length} installers. Their statuses: ${[...counts].map(([k, n]) => `${n} ${k}`).join(", ")}${neverLoggedIn ? `; ${neverLoggedIn} have never logged in` : ""}. Write it so it reads naturally for all of them.`;
      }
    }

    const existing =
      input.currentBody?.trim() || input.currentSubject?.trim()
        ? `\n\nCurrent draft to revise (keep what works unless told otherwise):\nSubject: ${input.currentSubject?.trim() ?? ""}\n${input.currentBody?.trim() ?? ""}`
        : "";

    const prompt = `${audience}\n\nAdmin's instructions: ${instructions || "Write a friendly check-in that invites them back to the platform."}${existing}`;

    const result = await generateTextWithFallback({
      model: getChatModel(),
      system: DRAFT_SYSTEM,
      prompt,
    });

    const draft = parseDraft(result.text);
    if (draft) return { success: true, ...draft };
    // Model ignored the JSON instruction — keep its text as the body rather than failing.
    return { success: true, subject: input.currentSubject?.trim() ?? "", body: result.text.trim() };
  } catch (err) {
    const msg = errMsg(err, "Generation failed.");
    if (/429|quota|RESOURCE_EXHAUSTED/.test(msg)) {
      return { success: false, error: "AI rate limit reached — try again in a minute." };
    }
    return { success: false, error: msg };
  }
}

// ── Sending ─────────────────────────────────────────────────────────────────

export interface OutreachSendResult {
  installerId: string;
  ok: boolean;
  error?: string;
}

function buildOutreachHtml(subject: string, body: string, includeDashboardButton: boolean, signOff: string): string {
  const cta = includeDashboardButton
    ? `<div style="text-align:center;margin:28px 0;">
        <a href="${getAppUrl()}/dashboard" style="display:inline-block;background-color:#facc15;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Open my dashboard</a>
      </div>`
    : "";
  const signature = `<p style="margin:24px 0 28px;color:#a3a3a3;font-size:14px;line-height:1.7;">${escapeHtml(signOff)}<br>Storage Network<br><span style="color:#737373;font-size:12px;">Just hit reply — this comes straight to me.</span></p>`;
  return masterEmailLayout(escapeHtml(subject), `${outreachTextToHtml(body)}${cta}${signature}`);
}

export async function sendOutreachEmails(input: {
  recipientIds: string[];
  subject: string;
  body: string;
  includeDashboardButton: boolean;
  grantComplimentaryPro: boolean;
}): Promise<{ success: true; results: OutreachSendResult[] } | { success: false; error: string }> {
  try {
    const admin = await requireAdmin();
    const subject = input.subject.trim();
    const body = input.body.trim();
    if (!subject) return { success: false, error: "Add a subject." };
    if (!body) return { success: false, error: "Write the email body first." };
    const badTags = unknownMergeTags(`${subject}\n${body}`);
    if (badTags.length) return { success: false, error: `Unknown merge tag(s): ${badTags.map((t) => `{{${t}}}`).join(", ")}` };

    const ids = [...new Set(input.recipientIds)];
    if (ids.length === 0) return { success: false, error: "No recipients selected." };
    if (ids.length > MAX_RECIPIENTS_PER_CALL) {
      return { success: false, error: `Send at most ${MAX_RECIPIENTS_PER_CALL} per batch.` };
    }

    const { data: rows, error } = await db()
      .from("profiles")
      .select("id, email, first_name, last_name, business_name, city, state")
      .in("id", ids);
    if (error) return { success: false, error: error.message };

    const signOff = admin.firstName ? `— ${admin.firstName}` : "— The Storage Network team";
    const senderName = admin.firstName ? `${admin.firstName} at Storage Network` : undefined;
    const results: OutreachSendResult[] = [];
    const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const r = byId.get(id);
      if (!r?.email) {
        results.push({ installerId: id, ok: false, error: "No email on file" });
        continue;
      }
      if (i > 0) await new Promise((res) => setTimeout(res, SEND_DELAY_MS));

      const personalSubject = applyMergeTags(subject, r);
      const personalBody = applyMergeTags(body, r);
      const res = await sendTransactionalEmail({
        to: r.email,
        subject: personalSubject,
        html: buildOutreachHtml(personalSubject, personalBody, input.includeDashboardButton, signOff),
        senderName,
        ...(admin.email && { replyTo: admin.email }),
      });

      if (!res.success) {
        results.push({ installerId: id, ok: false, error: res.error ?? "Send failed" });
        continue;
      }

      const { error: logErr } = await db().from("installer_outreach_emails").insert({
        installer_id: id,
        sent_by: admin.id,
        to_email: r.email,
        subject: personalSubject,
        body: personalBody,
        message_id: res.messageId ?? null,
      });
      if (logErr) console.warn("[Outreach] log insert failed (migration 145 applied?):", logErr.message);

      let compError: string | undefined;
      if (input.grantComplimentaryPro) {
        const comp = await applyComplimentaryPro(id, true);
        if (!comp.success) compError = `Sent, but free Pro not granted: ${comp.error}`;
      }
      results.push({ installerId: id, ok: true, ...(compError && { error: compError }) });
    }

    return { success: true, results };
  } catch (err) {
    return { success: false, error: errMsg(err, "Send failed.") };
  }
}

// ── Complimentary Pro + trial extension ─────────────────────────────────────

/** Give the installer a unique slug if they don't have one (Pro needs it for the branded link). */
async function ensureSlug(userId: string, current: { slug: string | null; business_name: string | null; first_name: string | null }): Promise<string> {
  if (current.slug) return current.slug;
  const base = slugify(current.business_name || current.first_name || "") || userId.slice(0, 8);
  for (const candidate of [base, `${base}-${new Date().getFullYear()}`, `${base}-${userId.slice(0, 4)}`]) {
    const { data: taken } = await db().from("profiles").select("id").eq("slug", candidate).neq("id", userId).maybeSingle();
    if (!taken) return candidate;
  }
  return `${base}-${userId.slice(0, 8)}`;
}

async function applyComplimentaryPro(
  installerId: string,
  enabled: boolean
): Promise<{ success: true; is_pro: boolean } | { success: false; error: string }> {
  const { data: p, error } = await db()
    .from("profiles")
    .select("slug, business_name, first_name, stripe_subscription_id, pro_trial_ends_at")
    .eq("id", installerId)
    .single();
  if (error || !p) return { success: false, error: error?.message ?? "Installer not found." };

  if (enabled) {
    if (p.stripe_subscription_id) {
      return { success: false, error: "Already a paying Pro subscriber — cancel their Stripe subscription first." };
    }
    // No trial clock (checkProTrial ignores profiles without pro_trial_ends_at)
    // and no subscription, so nothing ever bills or expires them.
    const { error: upErr } = await db()
      .from("profiles")
      .update({
        is_pro: true,
        pro_comped: true,
        pro_comped_at: new Date().toISOString(),
        pro_trial_ends_at: null,
        slug: await ensureSlug(installerId, p),
      })
      .eq("id", installerId);
    if (upErr) return { success: false, error: upErr.message };
    return { success: true, is_pro: true };
  }

  // Turning comp off drops them to Free — unless they've since subscribed.
  const keepsPro = !!p.stripe_subscription_id;
  const { error: upErr } = await db()
    .from("profiles")
    .update({
      pro_comped: false,
      pro_comped_at: null,
      ...(!keepsPro && { is_pro: false }),
    })
    .eq("id", installerId);
  if (upErr) return { success: false, error: upErr.message };
  return { success: true, is_pro: keepsPro };
}

export async function setComplimentaryPro(
  installerId: string,
  enabled: boolean
): Promise<{ success: true; is_pro: boolean } | { success: false; error: string }> {
  try {
    await requireAdmin();
    return await applyComplimentaryPro(installerId, enabled);
  } catch (err) {
    return { success: false, error: errMsg(err, "Failed to update Pro access.") };
  }
}

export async function extendProTrial(
  installerId: string,
  days: number
): Promise<{ success: true; trialEndsAt: string } | { success: false; error: string }> {
  try {
    await requireAdmin();
    if (!Number.isInteger(days) || days < 1 || days > MAX_TRIAL_EXTENSION_DAYS) {
      return { success: false, error: `Enter 1–${MAX_TRIAL_EXTENSION_DAYS} days.` };
    }

    const { data: p, error } = await db()
      .from("profiles")
      .select("slug, business_name, first_name, stripe_subscription_id, pro_trial_ends_at, pro_comped")
      .eq("id", installerId)
      .single();
    if (error || !p) return { success: false, error: error?.message ?? "Installer not found." };
    if (p.stripe_subscription_id) return { success: false, error: "They're a paying subscriber — no trial to extend." };
    if (p.pro_comped) return { success: false, error: "They have free Pro with no end date. Turn that off first to put them on a trial." };

    // Extend from the later of now or the current end, so an expired trial
    // restarts from today instead of landing in the past.
    const now = Date.now();
    const currentEnd = p.pro_trial_ends_at ? new Date(p.pro_trial_ends_at).getTime() : 0;
    const trialEndsAt = new Date(Math.max(now, currentEnd) + days * 86_400_000).toISOString();

    const { error: upErr } = await db()
      .from("profiles")
      .update({
        is_pro: true,
        pro_trial_ends_at: trialEndsAt,
        slug: await ensureSlug(installerId, p),
      })
      .eq("id", installerId);
    if (upErr) return { success: false, error: upErr.message };
    return { success: true, trialEndsAt };
  } catch (err) {
    return { success: false, error: errMsg(err, "Failed to extend trial.") };
  }
}
