"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor referral program — server actions
//
// Realtors share a `/refer/<code>` link; converted leads (deposit paid) credit
// them 5 totes via migration 119's credit_realtor_referral RPC. This module
// owns the code lifecycle (lazy generation + lookup) and the dashboard stats
// read. Crediting itself happens in the Stripe webhook + payments path.
// ═══════════════════════════════════════════════════════════════════════════

const TOTES_PER_CONVERSION = 5;

export interface RealtorReferralLink {
  code: string;
  shareUrl: string;
}

export interface RealtorReferralStats {
  conversionCount: number;
  totesEarned: number;
  shareUrl: string;
  code: string;
}

// ── Slug generator (8 chars, base32-ish, no ambiguous glyphs) ────────────
// 0/O and 1/I/L removed to keep links safe to read off a phone screen.
const SLUG_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateSlug(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return out;
}

function buildShareUrl(code: string): string {
  return `${getAppUrl()}/refer/${code}`;
}

// ─────────────────────────────────────────────────────────────────────────
// ensureRealtorReferralCode
//
// Returns the caller's referral code + share URL. Lazily generates the code
// on first call so we don't need a backfill in the migration. Retries on
// the (extremely unlikely) slug collision.
// ─────────────────────────────────────────────────────────────────────────
export async function ensureRealtorReferralCode(): Promise<{
  success: boolean;
  link?: RealtorReferralLink;
  error?: string;
}> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not signed in." };

  const db = getServiceClient();

  const { data: profile, error: readErr } = await db
    .from("profiles")
    .select("is_realtor, realtor_referral_code")
    .eq("id", user.id)
    .single();

  if (readErr || !profile) {
    return { success: false, error: "Profile not found." };
  }
  if (!profile.is_realtor) {
    return { success: false, error: "Referral codes are realtor-only." };
  }

  if (profile.realtor_referral_code) {
    return {
      success: true,
      link: {
        code: profile.realtor_referral_code,
        shareUrl: buildShareUrl(profile.realtor_referral_code),
      },
    };
  }

  // Allocate a fresh slug. Six attempts is overkill against a 31^8 space
  // (≈8.5e11) but the UNIQUE constraint is the source of truth either way.
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = generateSlug();
    const { error: writeErr } = await db
      .from("profiles")
      .update({ realtor_referral_code: slug })
      .eq("id", user.id)
      .is("realtor_referral_code", null);

    if (!writeErr) {
      // Re-read to confirm we won the race (a parallel call could have set
      // a different code on this same profile between our null-check and
      // update; the .is(null) guard prevents overwrite but we still need
      // the actual value).
      const { data: confirmed } = await db
        .from("profiles")
        .select("realtor_referral_code")
        .eq("id", user.id)
        .single();
      const code = confirmed?.realtor_referral_code;
      if (code) {
        return { success: true, link: { code, shareUrl: buildShareUrl(code) } };
      }
    }
    // Unique-violation = slug collision; loop and try again.
  }

  return { success: false, error: "Could not allocate a referral code." };
}

// ─────────────────────────────────────────────────────────────────────────
// resolveRealtorReferralCode
//
// Used by /refer/[code] to validate an inbound share link before setting
// the attribution cookie. Returns null for unknown / inactive realtors so
// junk codes don't pollute the leads table later.
// ─────────────────────────────────────────────────────────────────────────
export async function resolveRealtorReferralCode(
  code: string
): Promise<{ realtorId: string } | null> {
  if (!code || typeof code !== "string") return null;
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length < 4 || trimmed.length > 32) return null;

  const db = getServiceClient();
  const { data } = await db
    .from("profiles")
    .select("id, is_realtor, is_suspended")
    .eq("realtor_referral_code", trimmed)
    .maybeSingle();

  if (!data) return null;
  if (!data.is_realtor) return null;
  if (data.is_suspended === true) return null;

  return { realtorId: data.id as string };
}

// ─────────────────────────────────────────────────────────────────────────
// getRealtorReferralStats
//
// Powers the dashboard "Referrals" card. Counts converted leads + sums
// totes earned via the credits ledger.
// ─────────────────────────────────────────────────────────────────────────
export async function getRealtorReferralStats(): Promise<{
  success: boolean;
  stats?: RealtorReferralStats;
  error?: string;
}> {
  const linkResult = await ensureRealtorReferralCode();
  if (!linkResult.success || !linkResult.link) {
    return { success: false, error: linkResult.error || "No code." };
  }
  const { code, shareUrl } = linkResult.link;

  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not signed in." };

  const db = getServiceClient();
  const { data: credits, error } = await db
    .from("realtor_referral_credits")
    .select("totes_credited")
    .eq("realtor_id", user.id);

  if (error) {
    return { success: false, error: "Could not load referral stats." };
  }

  const conversionCount = credits?.length ?? 0;
  const totesEarned =
    credits?.reduce((sum, row) => sum + (row.totes_credited ?? 0), 0) ?? 0;

  return {
    success: true,
    stats: { code, shareUrl, conversionCount, totesEarned },
  };
}

export { TOTES_PER_CONVERSION };
