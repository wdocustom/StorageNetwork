import { getServiceClient } from "@/lib/supabase-server";
import { normalizeCurrency, type CurrencyCode } from "@/lib/geo/currency";
import { verifyTrackToken } from "@/lib/server/request-link";

// ═══════════════════════════════════════════════════════════════════════════
// Currency lookups — which currency a page, email or SMS should show.
//
// A job's money is in its installer's currency (profiles.currency). These
// helpers resolve that from whatever handle a caller has: an installer id,
// a lead id, a public profile slug or a tracking token. Every miss falls
// back to USD, which renders exactly as the app did before Canada.
// ═══════════════════════════════════════════════════════════════════════════

export async function currencyForInstaller(installerId: string | null | undefined): Promise<CurrencyCode> {
  if (!installerId) return "usd";
  try {
    const { data } = await getServiceClient()
      .from("profiles")
      .select("currency")
      .eq("id", installerId)
      .maybeSingle();
    return normalizeCurrency(data?.currency as string | null);
  } catch {
    return "usd";
  }
}

export async function currencyForLead(leadId: string | null | undefined): Promise<CurrencyCode> {
  if (!leadId || !/^[0-9a-f-]{36}$/i.test(leadId)) return "usd";
  try {
    const { data } = await getServiceClient()
      .from("leads")
      .select("installer_id")
      .eq("id", leadId)
      .maybeSingle();
    return currencyForInstaller(data?.installer_id as string | null);
  } catch {
    return "usd";
  }
}

export async function currencyForSlug(slug: string | null | undefined): Promise<CurrencyCode> {
  if (!slug) return "usd";
  try {
    const { data } = await getServiceClient()
      .from("profiles")
      .select("currency")
      .eq("slug", slug)
      .maybeSingle();
    return normalizeCurrency(data?.currency as string | null);
  } catch {
    return "usd";
  }
}

export async function currencyForTrackToken(token: string | null | undefined): Promise<CurrencyCode> {
  const leadId = token ? verifyTrackToken(token) : null;
  return currencyForLead(leadId);
}
