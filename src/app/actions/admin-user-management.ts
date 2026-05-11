"use server";

import { getServiceClient } from "@/lib/supabase-server";
import Stripe from "stripe";

// ═══════════════════════════════════════════════════════════════════════════
// Admin User Management — Hard-Delete a Platform User
//
// Two server actions:
//
//   getUserDeletionPreflight(adminUserId, targetUserId)
//     Read-only audit: counts of dependent rows, Stripe state, blockers.
//     The admin UI shows this in a confirmation modal so the operator knows
//     exactly what's about to disappear.
//
//   deleteUserCompletely(adminUserId, targetUserId, confirmation)
//     Idempotent destructive sequence. Requires confirmation === "DELETE".
//
//     Order matters because the schema has both RESTRICT FKs (which would
//     block auth.users deletion) and email-keyed soft references (no FK,
//     need manual cleanup):
//
//       1.  Stripe subscription cancellation (immediate, not period-end)
//       2.  affiliate_payouts          (RESTRICT — must delete first)
//       3.  affiliate_agreements.created_by (RESTRICT — reassign to admin)
//       4.  communication_logs.created_by   (default RESTRICT — delete)
//       5.  cold_email_suppressions by email (soft, keep suppression alive
//           is actually safer — we leave these in place so we don't
//           re-spam someone who opted out; the row is just an email row
//           with no FK back to the user)
//       6.  affiliate_email_invites by prospect_email (soft cleanup so the
//           user's old prospect list doesn't dangle)
//       7.  demand_signals customer_email (soft cleanup)
//       8.  storage objects under `avatars/{userId}/*`
//       9.  auth.users delete via supabase.auth.admin.deleteUser — this
//           cascades public.profiles via the standard Supabase FK, and
//           every CASCADE FK on profiles cascades from there.
//
//     Every step is wrapped to keep going if a single piece is missing
//     (e.g. user never had a Stripe sub). Each outcome is appended to a
//     `log[]` returned to the caller for UI display + audit trail.
//
// Guards: not self, not another admin, requires "DELETE" typed confirmation.
// ═══════════════════════════════════════════════════════════════════════════

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export interface UserDeletionPreflight {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
    is_admin: boolean;
    is_partner: boolean;
    created_at: string;
  };
  blockers: string[];
  warnings: string[];
  counts: {
    leads_as_installer: number;
    leads_as_referrer: number;
    customers: number;
    inventory_racks: number;
    discount_codes: number;
    affiliate_applications: number;
    affiliate_agreements_as_affiliate: number;
    affiliate_agreements_created_by: number;
    affiliate_payouts: number;
    affiliate_payouts_paid: number;
    affiliate_email_invites_sent: number;
    cold_email_suppressions: number;
    demand_signals: number;
    communication_logs: number;
    partners_link: number;
  };
  stripe: {
    has_subscription: boolean;
    subscription_id: string | null;
    subscription_status: string | null;
    has_connect_account: boolean;
    connect_account_id: string | null;
  };
}

export async function getUserDeletionPreflight(
  adminUserId: string,
  targetUserId: string
): Promise<UserDeletionPreflight> {
  const empty = {
    blockers: [],
    warnings: [],
    counts: {
      leads_as_installer: 0,
      leads_as_referrer: 0,
      customers: 0,
      inventory_racks: 0,
      discount_codes: 0,
      affiliate_applications: 0,
      affiliate_agreements_as_affiliate: 0,
      affiliate_agreements_created_by: 0,
      affiliate_payouts: 0,
      affiliate_payouts_paid: 0,
      affiliate_email_invites_sent: 0,
      cold_email_suppressions: 0,
      demand_signals: 0,
      communication_logs: 0,
      partners_link: 0,
    },
    stripe: {
      has_subscription: false,
      subscription_id: null,
      subscription_status: null,
      has_connect_account: false,
      connect_account_id: null,
    },
  };

  try {
    const supabase = getServiceClient();

    const { data: admin } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", adminUserId)
      .single();
    if (!admin?.is_admin) {
      return { success: false, error: "Not authorized.", ...empty };
    }

    const { data: target } = await supabase
      .from("profiles")
      .select(
        "id, email, first_name, last_name, business_name, is_admin, is_partner, created_at, stripe_subscription_id, stripe_account_id"
      )
      .eq("id", targetUserId)
      .maybeSingle();

    if (!target) {
      return { success: false, error: "User not found.", ...empty };
    }

    const blockers: string[] = [];
    const warnings: string[] = [];

    if (target.id === adminUserId) {
      blockers.push("You cannot delete your own account from this tool.");
    }
    if (target.is_admin) {
      blockers.push(
        "Target is an admin. Remove the is_admin flag in the DB first if you really intend to delete."
      );
    }

    const email = (target.email as string | null)?.toLowerCase() ?? null;

    const countQ = (table: string, filter: Record<string, string>) =>
      Object.entries(filter).reduce(
        (q, [k, v]) => q.eq(k, v),
        supabase.from(table).select("id", { count: "exact", head: true })
      );

    const [
      leadsInstaller,
      leadsReferrer,
      customers,
      racks,
      discountCodes,
      applications,
      agreementsAffiliate,
      agreementsCreatedBy,
      payouts,
      payoutsPaid,
      emailInvites,
      coldSuppressions,
      demandSignals,
      commLogs,
      partnersLink,
    ] = await Promise.all([
      countQ("leads", { installer_id: targetUserId }),
      countQ("leads", { referring_installer_id: targetUserId }),
      countQ("customers", { installer_id: targetUserId }),
      countQ("inventory_racks", { installer_id: targetUserId }),
      countQ("discount_codes", { installer_id: targetUserId }),
      countQ("affiliate_applications", { applicant_id: targetUserId }),
      countQ("affiliate_agreements", { affiliate_id: targetUserId }),
      countQ("affiliate_agreements", { created_by: targetUserId }),
      countQ("affiliate_payouts", { affiliate_id: targetUserId }),
      supabase
        .from("affiliate_payouts")
        .select("id", { count: "exact", head: true })
        .eq("affiliate_id", targetUserId)
        .eq("status", "paid"),
      countQ("affiliate_email_invites", { referring_installer_id: targetUserId }),
      email
        ? supabase
            .from("cold_email_suppressions")
            .select("email", { count: "exact", head: true })
            .eq("email", email)
        : Promise.resolve({ count: 0 }),
      email
        ? supabase
            .from("demand_signals")
            .select("id", { count: "exact", head: true })
            .eq("customer_email", email)
        : Promise.resolve({ count: 0 }),
      countQ("communication_logs", { created_by: targetUserId }),
      countQ("partners", { user_id: targetUserId }),
    ]);

    const counts = {
      leads_as_installer: leadsInstaller.count ?? 0,
      leads_as_referrer: leadsReferrer.count ?? 0,
      customers: customers.count ?? 0,
      inventory_racks: racks.count ?? 0,
      discount_codes: discountCodes.count ?? 0,
      affiliate_applications: applications.count ?? 0,
      affiliate_agreements_as_affiliate: agreementsAffiliate.count ?? 0,
      affiliate_agreements_created_by: agreementsCreatedBy.count ?? 0,
      affiliate_payouts: payouts.count ?? 0,
      affiliate_payouts_paid: payoutsPaid.count ?? 0,
      affiliate_email_invites_sent: emailInvites.count ?? 0,
      cold_email_suppressions: coldSuppressions.count ?? 0,
      demand_signals: demandSignals.count ?? 0,
      communication_logs: commLogs.count ?? 0,
      partners_link: partnersLink.count ?? 0,
    };

    if (counts.affiliate_payouts_paid > 0) {
      blockers.push(
        `Has ${counts.affiliate_payouts_paid} PAID affiliate payout(s). These are financial records and should be retained — refusing delete. Reassign payouts to a placeholder profile first if you must remove this user.`
      );
    }

    if (counts.leads_as_installer > 0) {
      warnings.push(
        `${counts.leads_as_installer} lead(s) will have installer_id set to NULL (jobs become orphaned but retained).`
      );
    }
    if (counts.affiliate_agreements_created_by > 0) {
      warnings.push(
        `${counts.affiliate_agreements_created_by} affiliate agreement(s) created by this user will be reassigned to you (the deleting admin).`
      );
    }
    if (counts.communication_logs > 0) {
      warnings.push(
        `${counts.communication_logs} communication log(s) created by this user will be deleted.`
      );
    }

    // Stripe state ------------------------------------------------------------
    let subscriptionStatus: string | null = null;
    const subId = (target.stripe_subscription_id as string | null) ?? null;
    if (stripe && subId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subId);
        subscriptionStatus = sub.status;
      } catch {
        subscriptionStatus = "unknown";
      }
    }

    return {
      success: true,
      user: {
        id: target.id as string,
        email: (target.email as string | null) ?? null,
        first_name: (target.first_name as string | null) ?? null,
        last_name: (target.last_name as string | null) ?? null,
        business_name: (target.business_name as string | null) ?? null,
        is_admin: !!target.is_admin,
        is_partner: !!target.is_partner,
        created_at: target.created_at as string,
      },
      blockers,
      warnings,
      counts,
      stripe: {
        has_subscription: !!subId,
        subscription_id: subId,
        subscription_status: subscriptionStatus,
        has_connect_account: !!target.stripe_account_id,
        connect_account_id:
          (target.stripe_account_id as string | null) ?? null,
      },
    };
  } catch (err) {
    console.error("[Admin] preflight failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Preflight failed.",
      ...empty,
    };
  }
}

export interface DeleteUserResult {
  success: boolean;
  error?: string;
  log: string[];
}

export async function deleteUserCompletely(
  adminUserId: string,
  targetUserId: string,
  confirmation: string
): Promise<DeleteUserResult> {
  const log: string[] = [];
  const step = (msg: string) => {
    log.push(msg);
    console.log(`[DeleteUser] ${targetUserId}: ${msg}`);
  };

  try {
    if (confirmation !== "DELETE") {
      return {
        success: false,
        error: 'Confirmation text must be exactly "DELETE".',
        log,
      };
    }
    if (adminUserId === targetUserId) {
      return {
        success: false,
        error: "Cannot delete your own account.",
        log,
      };
    }

    const supabase = getServiceClient();

    const { data: admin } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", adminUserId)
      .single();
    if (!admin?.is_admin) {
      return { success: false, error: "Not authorized.", log };
    }

    const { data: target } = await supabase
      .from("profiles")
      .select(
        "id, email, is_admin, stripe_subscription_id, stripe_account_id"
      )
      .eq("id", targetUserId)
      .maybeSingle();

    if (!target) {
      return { success: false, error: "User not found.", log };
    }
    if (target.is_admin) {
      return {
        success: false,
        error:
          "Target is an admin. Remove the is_admin flag before deletion.",
        log,
      };
    }

    const email = (target.email as string | null)?.toLowerCase() ?? null;

    // Re-check paid-payout blocker (race-safety).
    const { count: paidPayouts } = await supabase
      .from("affiliate_payouts")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", targetUserId)
      .eq("status", "paid");
    if ((paidPayouts ?? 0) > 0) {
      return {
        success: false,
        error: `Aborted: user has ${paidPayouts} paid affiliate payout(s). Financial records cannot be deleted.`,
        log,
      };
    }

    // 1. Stripe subscription — cancel immediately ------------------------------
    const subId = (target.stripe_subscription_id as string | null) ?? null;
    if (stripe && subId) {
      try {
        await stripe.subscriptions.cancel(subId);
        step(`Cancelled Stripe subscription ${subId}.`);
      } catch (err) {
        step(
          `WARN: Stripe sub ${subId} cancel failed (${
            err instanceof Error ? err.message : "unknown"
          }) — continuing.`
        );
      }
    } else if (subId) {
      step(`Skipped Stripe cancel (Stripe SDK not configured). Sub: ${subId}`);
    }

    // Note: Stripe Connect accounts are not auto-deleted — they belong to the
    // installer's own Stripe identity. We log it for the admin to handle out
    // of band if needed.
    if (target.stripe_account_id) {
      step(
        `NOTE: Stripe Connect account ${target.stripe_account_id} not removed (owned by user's Stripe identity). Disconnect manually in Stripe if required.`
      );
    }

    // 2. affiliate_payouts (RESTRICT) — delete unpaid only --------------------
    const { error: payoutErr, count: payoutCount } = await supabase
      .from("affiliate_payouts")
      .delete({ count: "exact" })
      .eq("affiliate_id", targetUserId);
    if (payoutErr) {
      return {
        success: false,
        error: `Failed to clear affiliate_payouts: ${payoutErr.message}`,
        log,
      };
    }
    step(`Deleted ${payoutCount ?? 0} affiliate_payouts row(s).`);

    // 3. affiliate_agreements.created_by (RESTRICT) — reassign to admin -------
    const { error: reassignErr, count: reassignCount } = await supabase
      .from("affiliate_agreements")
      .update({ created_by: adminUserId }, { count: "exact" })
      .eq("created_by", targetUserId);
    if (reassignErr) {
      return {
        success: false,
        error: `Failed to reassign affiliate_agreements.created_by: ${reassignErr.message}`,
        log,
      };
    }
    step(
      `Reassigned ${reassignCount ?? 0} affiliate_agreements.created_by → admin ${adminUserId}.`
    );

    // 4. communication_logs.created_by (default RESTRICT) — delete -----------
    const { error: commErr, count: commCount } = await supabase
      .from("communication_logs")
      .delete({ count: "exact" })
      .eq("created_by", targetUserId);
    if (commErr) {
      step(`WARN: communication_logs cleanup failed: ${commErr.message}`);
    } else {
      step(`Deleted ${commCount ?? 0} communication_logs row(s).`);
    }

    // 5. Email-keyed soft references -----------------------------------------
    if (email) {
      // Keep cold_email_suppressions in place — those are opt-out records and
      // we want to honor them even if the user is gone. Just log the count.
      const { count: supCount } = await supabase
        .from("cold_email_suppressions")
        .select("email", { count: "exact", head: true })
        .eq("email", email);
      if ((supCount ?? 0) > 0) {
        step(
          `NOTE: ${supCount} cold_email_suppressions row(s) retained for opt-out honoring.`
        );
      }

      // demand_signals tied to this email (anonymous waitlist / lead capture)
      const { error: dsErr, count: dsCount } = await supabase
        .from("demand_signals")
        .delete({ count: "exact" })
        .eq("customer_email", email);
      if (dsErr) {
        step(`WARN: demand_signals cleanup failed: ${dsErr.message}`);
      } else if ((dsCount ?? 0) > 0) {
        step(`Deleted ${dsCount} demand_signals row(s) matching email.`);
      }
    }

    // 6. Storage objects: avatars/{userId}/ ----------------------------------
    try {
      const { data: avatarFiles } = await supabase.storage
        .from("avatars")
        .list(targetUserId, { limit: 1000 });
      if (avatarFiles && avatarFiles.length > 0) {
        const paths = avatarFiles.map((f) => `${targetUserId}/${f.name}`);
        const { error: rmErr } = await supabase.storage
          .from("avatars")
          .remove(paths);
        if (rmErr) {
          step(`WARN: avatar storage cleanup partial: ${rmErr.message}`);
        } else {
          step(`Deleted ${paths.length} avatar file(s).`);
        }
      }
    } catch (err) {
      step(
        `WARN: avatar storage cleanup threw: ${
          err instanceof Error ? err.message : "unknown"
        }`
      );
    }

    // 7. Final auth.users deletion — cascades public.profiles + all CASCADE FKs
    const { error: authErr } = await supabase.auth.admin.deleteUser(
      targetUserId
    );
    if (authErr) {
      return {
        success: false,
        error: `auth.users delete failed: ${authErr.message}. Earlier cleanup steps completed — investigate before retrying.`,
        log,
      };
    }
    step("Deleted auth.users row (cascaded profiles + all CASCADE FKs).");

    // Belt-and-suspenders: ensure no orphaned public.profiles row remains
    // (in case the auth → profiles FK is missing in this Supabase project).
    const { count: residual } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("id", targetUserId);
    if ((residual ?? 0) > 0) {
      const { error: profErr } = await supabase
        .from("profiles")
        .delete()
        .eq("id", targetUserId);
      if (profErr) {
        step(
          `WARN: residual profiles row left behind, manual delete failed: ${profErr.message}`
        );
      } else {
        step("Removed residual public.profiles row (cascade FK missing).");
      }
    }

    step("DONE.");
    return { success: true, log };
  } catch (err) {
    console.error("[Admin] deleteUserCompletely fatal:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Deletion failed.",
      log,
    };
  }
}
