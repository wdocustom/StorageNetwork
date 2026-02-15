"use server";

import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Partner Actions — Affiliate Dashboard Data
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PartnerCommission {
  active_count: number;
  tier_rate: number;
  projected_monthly: number;
  tier_label: string;
}

export interface ReferralRow {
  id: string;
  status: string;
  created_at: string;
  installer_name: string;
  installer_business: string | null;
}

export interface PartnerDashboardData {
  success: boolean;
  partner?: {
    id: string;
    name: string;
    company: string;
    slug: string;
  };
  commission?: PartnerCommission;
  referrals?: ReferralRow[];
  totalReferrals?: number;
  error?: string;
}

/**
 * Fetch all data for the Partner Dashboard.
 * Requires the logged-in user to be a partner (is_partner=true, linked in partners table).
 */
export async function getPartnerDashboard(
  userId: string
): Promise<PartnerDashboardData> {
  try {
    // 1. Verify is_partner flag
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_partner")
      .eq("id", userId)
      .single();

    if (!profile?.is_partner) {
      return { success: false, error: "Not authorized as a partner." };
    }

    // 2. Get partner record
    const { data: partner } = await supabase
      .from("partners")
      .select("id, name, company, slug")
      .eq("user_id", userId)
      .single();

    if (!partner) {
      return { success: false, error: "Partner record not found." };
    }

    // 3. Calculate commission via Postgres function
    const { data: commissionRows } = await supabase.rpc(
      "calculate_partner_commission",
      { p_partner_id: partner.id }
    );

    const commission: PartnerCommission = commissionRows?.[0] ?? {
      active_count: 0,
      tier_rate: 35,
      projected_monthly: 0,
      tier_label: "Tier 1: $35/installer",
    };

    // 4. Get installer ledger (all referrals with profile details)
    const { data: rawReferrals } = await supabase
      .from("referrals")
      .select(
        "id, status, created_at, installer_id"
      )
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false });

    // Fetch installer profile data for each referral
    const referrals: ReferralRow[] = [];
    if (rawReferrals) {
      const installerIds = rawReferrals.map((r) => r.installer_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, business_name")
        .in("id", installerIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p])
      );

      for (const ref of rawReferrals) {
        const p = profileMap.get(ref.installer_id);
        referrals.push({
          id: ref.id,
          status: ref.status,
          created_at: ref.created_at,
          installer_name: p
            ? [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown"
            : "Unknown",
          installer_business: p?.business_name ?? null,
        });
      }
    }

    return {
      success: true,
      partner,
      commission,
      referrals,
      totalReferrals: referrals.length,
    };
  } catch (err) {
    console.error("[Partner] Dashboard fetch failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load partner data.",
    };
  }
}
