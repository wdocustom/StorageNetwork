"use server";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Partner Actions — Affiliate Dashboard Data
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

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
  is_suspended: boolean;
  suspension_reason: "manual" | "payment" | null;
  stripe_connected: boolean;
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
  is_pro: boolean;
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
        .select("id, first_name, last_name, business_name, is_pro")
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
          is_pro: p?.is_pro === true,
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

// ═══════════════════════════════════════════════════════════════════════════
// Admin: Network Referral Bounties
// Shows all referral leads across the platform with bounty details
// ═══════════════════════════════════════════════════════════════════════════

export interface BountyLead {
  id: string;
  referring_installer_id: string;
  referring_name: string;
  referring_business: string | null;
  installer_id: string;
  installer_name: string;
  installer_business: string | null;
  customer_city: string | null;
  customer_state: string | null;
  bounty_status: string;
  bounty_amount: number | null;
  deposit_amount: number;
  deposit_paid: boolean;
  estimated_price: number | null;
  created_at: string;
}

export interface ReferrerSummary {
  installer_id: string;
  name: string;
  business: string | null;
  is_pro: boolean;
  total_referrals: number;
  paid_count: number;
  pending_count: number;
  total_earned: number;
  total_pending_value: number;
  leads: BountyLead[];
}

export async function getAdminReferralBounties(
  userId: string
): Promise<{ success: boolean; referrers?: ReferrerSummary[]; totals?: { totalPaid: number; totalPending: number; totalReferrals: number }; error?: string }> {
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

    // Fetch all leads that have a referring installer
    const { data: leads, error } = await supabase
      .from("leads")
      .select(
        "id, referring_installer_id, installer_id, bounty_status, bounty_amount, deposit_amount, deposit_paid, estimated_price, address_city, address_state, created_at"
      )
      .not("referring_installer_id", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!leads || leads.length === 0) {
      return { success: true, referrers: [], totals: { totalPaid: 0, totalPending: 0, totalReferrals: 0 } };
    }

    // Gather all unique installer IDs (referrers + assigned)
    const allInstallerIds = new Set<string>();
    for (const lead of leads) {
      if (lead.referring_installer_id) allInstallerIds.add(lead.referring_installer_id);
      if (lead.installer_id) allInstallerIds.add(lead.installer_id);
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, business_name, is_pro")
      .in("id", Array.from(allInstallerIds));

    const profileMap = new Map(
      (profiles ?? []).map((p) => [
        p.id,
        {
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
          business: p.business_name as string | null,
          is_pro: p.is_pro ?? false,
        },
      ])
    );

    // Group leads by referring installer
    const referrerMap = new Map<string, ReferrerSummary>();

    for (const lead of leads) {
      const refId = lead.referring_installer_id!;
      const refProfile = profileMap.get(refId);
      const instProfile = profileMap.get(lead.installer_id);

      if (!referrerMap.has(refId)) {
        referrerMap.set(refId, {
          installer_id: refId,
          name: refProfile?.name || "Unknown",
          business: refProfile?.business || null,
          is_pro: refProfile?.is_pro ?? false,
          total_referrals: 0,
          paid_count: 0,
          pending_count: 0,
          total_earned: 0,
          total_pending_value: 0,
          leads: [],
        });
      }

      const summary = referrerMap.get(refId)!;
      summary.total_referrals++;

      if (lead.bounty_status === "paid") {
        summary.paid_count++;
        summary.total_earned += lead.bounty_amount || 0;
      } else if (lead.bounty_status === "pending") {
        summary.pending_count++;
        // Estimate pending bounty: 30% of deposit, min $15
        const est = Math.max(15, (lead.deposit_amount || 0) * 0.3);
        summary.total_pending_value += est;
      }

      summary.leads.push({
        id: lead.id,
        referring_installer_id: refId,
        referring_name: refProfile?.name || "Unknown",
        referring_business: refProfile?.business || null,
        installer_id: lead.installer_id,
        installer_name: instProfile?.name || "Unknown",
        installer_business: instProfile?.business || null,
        customer_city: lead.address_city,
        customer_state: lead.address_state,
        bounty_status: lead.bounty_status,
        bounty_amount: lead.bounty_amount,
        deposit_amount: lead.deposit_amount || 0,
        deposit_paid: lead.deposit_paid || false,
        estimated_price: lead.estimated_price,
        created_at: lead.created_at,
      });
    }

    const referrers = Array.from(referrerMap.values()).sort(
      (a, b) => b.total_referrals - a.total_referrals
    );

    const totalPaid = referrers.reduce((s, r) => s + r.total_earned, 0);
    const totalPending = referrers.reduce((s, r) => s + r.total_pending_value, 0);
    const totalReferrals = referrers.reduce((s, r) => s + r.total_referrals, 0);

    return {
      success: true,
      referrers,
      totals: { totalPaid, totalPending, totalReferrals },
    };
  } catch (err) {
    console.error("[Admin] Referral bounties fetch failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load bounties.",
    };
  }
}

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
        "id, email, first_name, last_name, business_name, slug, is_pro, is_partner, city, state, phone, completed_jobs, job_score, created_at, last_login_at, is_suspended, suspension_reason, stripe_account_id"
      )
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    // Count actual jobs from leads table (source of truth) instead of
    // relying on profiles.completed_jobs which can drift out of sync.
    // "Bookings" = deposit_paid leads, "Completed" = status 'paid'
    const { data: allLeads } = await supabase
      .from("leads")
      .select("installer_id, status, deposit_paid");

    const jobCounts: Record<string, { bookings: number; completed: number }> = {};
    for (const lead of allLeads || []) {
      const instId = lead.installer_id as string;
      if (!instId) continue;
      if (!jobCounts[instId]) jobCounts[instId] = { bookings: 0, completed: 0 };
      if (lead.deposit_paid) jobCounts[instId].bookings++;
      if (lead.status === "paid") jobCounts[instId].completed++;
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://storage-network.app";

    const users: PlatformUser[] = (allProfiles ?? []).map((p) => {
      const bookingParam =
        p.is_pro && p.slug
          ? `installer=${encodeURIComponent(p.slug)}`
          : `installer_id=${p.id}`;

      const counts = jobCounts[p.id] || { bookings: 0, completed: 0 };

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
        completed_jobs: counts.bookings,
        job_score: p.job_score ?? 0,
        created_at: p.created_at,
        last_login_at: p.last_login_at ?? null,
        booking_link: `${baseUrl}/design?${bookingParam}`,
        is_suspended: p.is_suspended ?? false,
        suspension_reason: p.suspension_reason ?? null,
        stripe_connected: !!p.stripe_account_id,
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

// ═══════════════════════════════════════════════════════════════════════════
// toggleInstallerSuspension — Admin manually suspends / unsuspends an
// installer account.  Sets is_suspended + suspension_reason='manual'.
// On unsuspend, clears both fields.
// ═══════════════════════════════════════════════════════════════════════════
export async function toggleInstallerSuspension(
  adminUserId: string,
  installerId: string,
  suspend: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify caller is admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", adminUserId)
      .single();

    if (!adminProfile?.is_admin) {
      return { success: false, error: "Not authorized." };
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        is_suspended: suspend,
        suspension_reason: suspend ? "manual" : null,
      })
      .eq("id", installerId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("[Admin] Suspension toggle failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to toggle suspension.",
    };
  }
}
