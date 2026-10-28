import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { getDepositAmount } from "@/app/actions/fee-engine";
import JobTicketView, { type LeadDetail } from "./JobTicketView";
import { INSTALLER_COLUMNS, LEAD_COLUMNS, toInstallerTicketData, type SavedCard } from "./ticket-data";

// Job ticket — loaded on the server so the work order arrives filled in.
// Two parallel rounds: the lead + the installer's profile, then the
// customer's saved card + the deposit (both depend on the lead).

export default async function JobTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/dashboard/leads/${id}`)}`);

  const db = getServiceClient();
  const [leadRes, profileRes] = await Promise.all([
    db.from("leads").select(LEAD_COLUMNS).eq("id", id).eq("installer_id", user.id).maybeSingle(),
    db.from("profiles").select(INSTALLER_COLUMNS).eq("id", user.id).single(),
  ]);

  const lead = leadRes.data as unknown as LeadDetail | null;
  if (!lead) {
    if (leadRes.error) console.error("[JobTicket] Lead fetch error:", leadRes.error.message);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
        <p className="mb-4 text-lg font-bold text-red-400">Lead not found or access denied.</p>
        <Link href="/dashboard/leads" className="text-sm text-yellow-400 underline hover:text-yellow-300">
          Back to Jobs
        </Link>
      </div>
    );
  }

  const total = lead.estimated_price || 0;
  const [savedCard, deposit] = await Promise.all([
    // No saved card on this lead — the same customer may have saved one on a
    // previous quote with this installer ("Charge Card on File").
    !lead.stripe_payment_method_id && lead.customer_id
      ? db
          .from("customers")
          .select("stripe_payment_method_id, stripe_payment_method_brand, stripe_payment_method_last4")
          .eq("id", lead.customer_id)
          .maybeSingle()
          .then(({ data }): SavedCard | null =>
            data?.stripe_payment_method_id
              ? { brand: data.stripe_payment_method_brand, last4: data.stripe_payment_method_last4 }
              : null,
          )
      : Promise.resolve(null),
    // The deposit actually charged when there is one (custom rates); else computed.
    lead.deposit_amount && lead.deposit_amount > 0
      ? Promise.resolve(lead.deposit_amount)
      : total > 0
        ? getDepositAmount(total, lead.installer_id ?? undefined)
        : Promise.resolve(0),
  ]);

  return (
    <JobTicketView
      key={lead.id}
      initialLead={lead}
      initialSavedCard={savedCard}
      installer={toInstallerTicketData(profileRes.data)}
      initialDeposit={deposit}
    />
  );
}
