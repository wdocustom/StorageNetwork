"use server";

import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Partner Actions — Affiliate Dashboard Data
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PlatformUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  slug: string | null;
  is_pro: boolean;
  is_partner: boolean;
  city: string | null;
  state: string | null;
  phone: string | null;
  completed_jobs: number;
  job_score: number;
  created_at: string;
  last_login_at: string | null;
  booking_link: string;
}

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
  isAdmin?: boolean;
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
    // 1. Verify is_partner flag + check admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_partner, is_admin")
      .eq("id", userId)
      .single();

    if (!profile?.is_partner) {
      return { success: false, error: "Not authorized as a partner." };
    }

    const isAdmin = profile.is_admin === true;

    // 2. Get partner record (linked by user_id)
    let { data: partner } = await supabase
      .from("partners")
      .select("id, name, company, slug")
      .eq("user_id", userId)
      .single();

    // Auto-link: if is_partner=true but no partner record is linked yet,
    // try to find an unlinked partner by matching the profile's email
    if (!partner) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const email = authUser?.user?.email;

      if (email) {
        const { data: unlinked } = await supabase
          .from("partners")
          .select("id, name, company, slug")
          .eq("email", email)
          .is("user_id", null)
          .single();

        if (unlinked) {
          // Auto-link this partner record to the logged-in user
          await supabase
            .from("partners")
            .update({ user_id: userId })
            .eq("id", unlinked.id);
          partner = unlinked;
          console.log(`✅ Auto-linked partner ${unlinked.id} to user ${userId}`);
        }
      }
    }

    // Still no partner? Try matching by name from profile
    if (!partner) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("first_name, last_name, business_name")
        .eq("id", userId)
        .single();

      if (prof) {
        const fullName = [prof.first_name, prof.last_name].filter(Boolean).join(" ");

        // Try exact name match on partner record, then company match
        const candidates = [fullName, prof.business_name].filter(Boolean) as string[];
        for (const matchName of candidates) {
          // Match against partner name
          const { data: byName } = await supabase
            .from("partners")
            .select("id, name, company, slug")
            .is("user_id", null)
            .ilike("name", matchName)
            .maybeSingle();

          if (byName) {
            await supabase.from("partners").update({ user_id: userId }).eq("id", byName.id);
            partner = byName;
            console.log(`✅ Auto-linked partner ${byName.id} to user ${userId} (name: ${matchName})`);
            break;
          }

          // Match against partner company
          const { data: byCompany } = await supabase
            .from("partners")
            .select("id, name, company, slug")
            .is("user_id", null)
            .ilike("company", matchName)
            .maybeSingle();

          if (byCompany) {
            await supabase.from("partners").update({ user_id: userId }).eq("id", byCompany.id);
            partner = byCompany;
            console.log(`✅ Auto-linked partner ${byCompany.id} to user ${userId} (company: ${matchName})`);
            break;
          }
        }
      }
    }

    if (!partner) {
      return {
        success: false,
        error: "Your partner record hasn't been linked yet. Please contact support.",
      };
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
      isAdmin,
    };
  } catch (err) {
    console.error("[Partner] Dashboard fetch failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load partner data.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Admin: Get All Platform Users
// Only accessible by users with is_admin=true
// ═══════════════════════════════════════════════════════════════════════════

export async function getAdminPlatformUsers(
  userId: string
): Promise<{ success: boolean; users?: PlatformUser[]; error?: string }> {
  try {
    // Verify admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: "Not authorized." };
    }

    // Fetch all profiles
    const { data: allProfiles, error } = await supabase
      .from("profiles")
      .select(
        "id, email, first_name, last_name, business_name, slug, is_pro, is_partner, city, state, phone, completed_jobs, job_score, created_at, last_login_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://storage-network.app";

    const users: PlatformUser[] = (allProfiles ?? []).map((p) => {
      const bookingParam =
        p.is_pro && p.slug
          ? `installer=${encodeURIComponent(p.slug)}`
          : `installer_id=${p.id}`;

      return {
        id: p.id,
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        business_name: p.business_name,
        slug: p.slug,
        is_pro: p.is_pro ?? false,
        is_partner: p.is_partner ?? false,
        city: p.city,
        state: p.state,
        phone: p.phone,
        completed_jobs: p.completed_jobs ?? 0,
        job_score: p.job_score ?? 0,
        created_at: p.created_at,
        last_login_at: p.last_login_at ?? null,
        booking_link: `${baseUrl}/design?${bookingParam}`,
      };
    });

    return { success: true, users };
  } catch (err) {
    console.error("[Admin] Platform users fetch failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load users.",
    };
  }
}
