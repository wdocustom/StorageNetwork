import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════════════════
// Legacy DIY plan success URL. Plans are now delivered (and payment
// verified server-side) on /plans/build — forward anything that still
// lands here, e.g. a Stripe session created before the switch.
// ═══════════════════════════════════════════════════════════════════════════

export default async function DIYCheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sessionId = typeof params.session_id === "string" ? params.session_id : "";
  const config = typeof params.config === "string" ? params.config : "";

  if (sessionId) redirect(`/plans/build?session_id=${encodeURIComponent(sessionId)}`);
  if (params.access === "pro" && config) {
    redirect(`/plans/build?access=pro&config=${encodeURIComponent(config)}`);
  }
  redirect("/design");
}
