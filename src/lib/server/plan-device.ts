import "server-only";

import { createHash, randomInt, randomUUID, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { getServiceClient } from "@/lib/supabase-server";
import { sendPlanDeviceCodeEmail } from "@/lib/emails/plansTemplates";

// ═══════════════════════════════════════════════════════════════════════════
// Plan links belong to the buyer, not to whoever has the link.
//
// Every DIY plan link (tote plan, ladder jig, chair plans, My Builds) is an
// access token in a URL. On its own that's a bearer link anyone can be
// forwarded. This gate ties it to the buyer's devices:
//
//   • The device they paid on, or the first device to ever open one of their
//     links (purchases made before this gate), is remembered by a cookie.
//   • Any other device gets "confirm it's you" and a 6-digit code emailed to
//     the buyer — a friend with the link doesn't have the buyer's inbox.
//   • Up to MAX_DEVICES active per buyer email; verifying another retires the
//     least recently used, so the buyer is never locked out.
//
// Devices are per buyer email, so one verification covers all their plans.
// Rows are never deleted — admin analytics flags buyers with many devices.
// ═══════════════════════════════════════════════════════════════════════════

export const PLAN_DEVICE_COOKIE = "sn_plan_device";
export const MAX_DEVICES = 3;
const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // browsers cap at ~400 days

export type DeviceCheck = { ok: true } | { ok: false; emailHint: string };

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const norm = (email: string) => email.trim().toLowerCase();

/** "judy@gmail.com" → "ju•••@gmail.com" */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "your email";
  return `${user.slice(0, 2)}•••@${domain}`;
}

async function readDeviceId(): Promise<string | null> {
  const v = (await cookies()).get(PLAN_DEVICE_COOKIE)?.value;
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

/** This browser's device id, creating the cookie if it has none. */
async function ensureDeviceId(): Promise<string> {
  const existing = await readDeviceId();
  if (existing) return existing;
  const id = randomUUID();
  (await cookies()).set(PLAN_DEVICE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return id;
}

async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 300) || null,
  };
}

async function registerDevice(email: string, deviceId: string, via: "first" | "checkout" | "code"): Promise<void> {
  const db = getServiceClient();
  const meta = await requestMeta();
  const now = new Date().toISOString();
  const { error } = await db.from("plan_buyer_devices").upsert(
    {
      email,
      device_hash: sha(deviceId),
      verified_by: via,
      user_agent: meta.userAgent,
      ip: meta.ip,
      last_seen_at: now,
      revoked_at: null,
    },
    { onConflict: "email,device_hash" },
  );
  if (error) {
    console.error("[PlanDevice] register failed:", error.message);
    return;
  }
  // Keep the newest MAX_DEVICES; retire the rest.
  const { data: active } = await db
    .from("plan_buyer_devices")
    .select("id")
    .eq("email", email)
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });
  const extra = (active ?? []).slice(MAX_DEVICES).map((r) => r.id as string);
  if (extra.length) await db.from("plan_buyer_devices").update({ revoked_at: now }).in("id", extra);
}

/**
 * May this browser open the buyer's plans? `trusted` is for the buyer's own
 * Stripe checkout return — that device is registered without a code.
 */
export async function checkPlanDevice(rawEmail: string, opts: { trusted?: boolean } = {}): Promise<DeviceCheck> {
  const email = norm(rawEmail);
  const db = getServiceClient();
  const deviceId = await readDeviceId();

  if (deviceId) {
    const { data: known } = await db
      .from("plan_buyer_devices")
      .select("id")
      .eq("email", email)
      .eq("device_hash", sha(deviceId))
      .is("revoked_at", null)
      .maybeSingle();
    if (known) {
      await db.from("plan_buyer_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", known.id);
      return { ok: true };
    }
  }

  if (opts.trusted) {
    await registerDevice(email, await ensureDeviceId(), "checkout");
    return { ok: true };
  }

  // No device on record at all (bought before this gate): the first one in
  // is the buyer's.
  const { count } = await db
    .from("plan_buyer_devices")
    .select("id", { count: "exact", head: true })
    .eq("email", email);
  if (!count) {
    await registerDevice(email, await ensureDeviceId(), "first");
    return { ok: true };
  }

  return { ok: false, emailHint: maskEmail(email) };
}

/** Read-only check for route handlers that can't set cookies mid-stream. */
export async function isKnownPlanDevice(rawEmail: string): Promise<boolean> {
  const deviceId = await readDeviceId();
  if (!deviceId) return false;
  const { data } = await getServiceClient()
    .from("plan_buyer_devices")
    .select("id")
    .eq("email", norm(rawEmail))
    .eq("device_hash", sha(deviceId))
    .is("revoked_at", null)
    .maybeSingle();
  return !!data;
}

const codeHash = (email: string, code: string) => sha(`${email}:${code}`);

export type SendCodeResult = { ok: true; emailHint: string } | { ok: false; error: string };

/** Email the buyer a fresh 6-digit code. Throttled per buyer. */
export async function sendPlanDeviceCode(rawEmail: string): Promise<SendCodeResult> {
  const email = norm(rawEmail);
  const db = getServiceClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await db
    .from("plan_access_codes")
    .select("created_at")
    .eq("email", email)
    .gte("created_at", hourAgo)
    .order("created_at", { ascending: false });
  if (recent?.length) {
    const lastAgo = Date.now() - new Date(recent[0].created_at as string).getTime();
    if (lastAgo < RESEND_AFTER_MS) {
      return { ok: false, error: `We just sent a code. Try again in ${Math.ceil((RESEND_AFTER_MS - lastAgo) / 1000)} seconds.` };
    }
    if (recent.length >= MAX_CODES_PER_HOUR) {
      return { ok: false, error: "Too many codes requested. Please wait an hour and try again." };
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { ip } = await requestMeta();
  const { error } = await db.from("plan_access_codes").insert({
    email,
    code_hash: codeHash(email, code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    ip,
  });
  if (error) {
    console.error("[PlanDevice] code insert failed:", error.message);
    return { ok: false, error: "We couldn't send a code. Please try again." };
  }
  const sent = await sendPlanDeviceCodeEmail(email, code);
  if (!sent.success) return { ok: false, error: "We couldn't send the email. Please try again." };
  return { ok: true, emailHint: maskEmail(email) };
}

export type VerifyCodeResult = { ok: true } | { ok: false; error: string };

/** Check the code and, if right, remember this device for the buyer. */
export async function verifyPlanDeviceCode(rawEmail: string, rawCode: string): Promise<VerifyCodeResult> {
  const email = norm(rawEmail);
  const code = rawCode.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, error: "Enter the 6-digit code from the email." };

  const db = getServiceClient();
  const { data: row } = await db
    .from("plan_access_codes")
    .select("id, code_hash, attempts, expires_at")
    .eq("email", email)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row || new Date(row.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: "That code has expired. Send a new one." };
  }
  if ((row.attempts as number) >= CODE_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many wrong tries. Send a new code." };
  }

  const expected = Buffer.from(row.code_hash as string);
  const given = Buffer.from(codeHash(email, code));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await db.from("plan_access_codes").update({ attempts: (row.attempts as number) + 1 }).eq("id", row.id);
    return { ok: false, error: "That code isn't right. Check the email and try again." };
  }

  await db.from("plan_access_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  await registerDevice(email, await ensureDeviceId(), "code");
  return { ok: true };
}
