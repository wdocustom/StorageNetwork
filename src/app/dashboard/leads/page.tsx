import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { listQuoteRequests } from "@/app/actions/quote-requests";
import JobsView, { type LeadItem, type TabKey } from "./JobsView";
import { JOB_COLUMNS, JOBS_EXCLUDED, JOBS_OR, UNPAID_COLUMNS, unpaidOr } from "./queries";

// Jobs tab — every list loads here in one parallel pass on the server, so the
// page arrives filled in. `?tab=` deep-links a tab (the "new quote request"
// email links to ?tab=requests).

const TABS: TabKey[] = ["active", "unpaid", "past", "requests"];

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?redirect=/dashboard/leads");

  const { tab } = await searchParams;
  const db = getServiceClient();

  const [jobsRes, unpaidRes, requestsRes] = await Promise.all([
    db
      .from("leads")
      .select(JOB_COLUMNS)
      .eq("installer_id", user.id)
      .or(JOBS_OR)
      .not("status", "in", JOBS_EXCLUDED)
      .order("created_at", { ascending: false }),
    db
      .from("leads")
      .select(UNPAID_COLUMNS)
      .eq("installer_id", user.id)
      .eq("deposit_paid", false)
      .or(unpaidOr())
      .order("created_at", { ascending: false }),
    listQuoteRequests(),
  ]);

  return (
    <JobsView
      initialLeads={(jobsRes.data ?? []) as unknown as LeadItem[]}
      initialUnpaid={(unpaidRes.data ?? []) as unknown as LeadItem[]}
      initialRequests={requestsRes.requests ?? []}
      initialTab={TABS.includes(tab as TabKey) ? (tab as TabKey) : "active"}
    />
  );
}
