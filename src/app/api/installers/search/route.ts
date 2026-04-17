import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { zipCache } from "@/lib/cache";

const INSTALLER_SELECT =
  "id, business_name, stripe_account_id, avatar_url, phone, lead_time_days, working_days, tier, is_pro, is_suspended, completed_jobs, current_month_leads, max_monthly_leads";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

function toInstallerResponse(inst: Record<string, unknown>) {
  return {
    available: true,
    installer: {
      id: inst.id,
      name: inst.business_name,
      stripe_account_id: inst.stripe_account_id,
      avatar_url: inst.avatar_url,
      phone: inst.phone,
      lead_time_days: (inst.lead_time_days as number) ?? 5,
      working_days: (inst.working_days as string[]) ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
      tier: (inst.tier as string) ?? "standard",
    },
    message: `${(inst.business_name as string) ?? "A local installer"} serves your area.`,
  };
}

/**
 * GET /api/installers/search?zip=68105
 *
 * Public endpoint: searches for installers by ZIP code.
 * Returns the highest-priority installer via tiered ranking:
 * is_pro DESC, completed_jobs DESC, current_month_leads ASC
 */
export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const zip = req.nextUrl.searchParams.get("zip")?.trim() ?? "";

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      { available: false, installer: null, message: "Invalid ZIP code." },
      { status: 400 }
    );
  }

  const body = await zipCache.getOrFetch(`api:${zip}`, async () => {
    try {
      const { data: matches, error } = await supabase
        .from("profiles")
        .select(INSTALLER_SELECT)
        .contains("service_zips", [zip])
        .neq("is_suspended", true)
        .order("is_pro", { ascending: false, nullsFirst: false })
        .order("completed_jobs", { ascending: false, nullsFirst: false })
        .order("current_month_leads", { ascending: true, nullsFirst: true });

      if (!error && matches && matches.length > 0) {
        for (const inst of matches) {
          const current = (inst.current_month_leads as number) ?? 0;
          const max = (inst.max_monthly_leads as number) ?? 25;
          if (current < max) {
            return toInstallerResponse(inst as Record<string, unknown>);
          }
        }
        return {
          available: false,
          installer: null,
          message: "All installers in this area are currently at capacity.",
        };
      }

      // Fallback: exact match on service_zip
      const { data: fbMatches, error: fbErr } = await supabase
        .from("profiles")
        .select(INSTALLER_SELECT)
        .eq("service_zip", zip)
        .neq("is_suspended", true)
        .order("is_pro", { ascending: false, nullsFirst: false })
        .order("completed_jobs", { ascending: false, nullsFirst: false })
        .order("current_month_leads", { ascending: true, nullsFirst: true });

      if (!fbErr && fbMatches && fbMatches.length > 0) {
        for (const inst of fbMatches) {
          const current = (inst.current_month_leads as number) ?? 0;
          const max = (inst.max_monthly_leads as number) ?? 25;
          if (current < max) {
            return toInstallerResponse(inst as Record<string, unknown>);
          }
        }
        return {
          available: false,
          installer: null,
          message: "All installers in this area are currently at capacity.",
        };
      }

      return {
        available: false,
        installer: null,
        message: "We aren\u2019t in this area yet. Join the waitlist?",
      };
    } catch {
      return {
        available: false,
        installer: null,
        message: "Search failed. Please try again.",
      };
    }
  });

  return NextResponse.json(body, { headers: CACHE_HEADERS });
}
