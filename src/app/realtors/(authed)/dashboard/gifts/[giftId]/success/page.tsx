// ═══════════════════════════════════════════════════════════════════════════
// Realtor → Gift → Success
//
// Lands here after Stripe redirects. Calls verifyGiftPurchase to flip the
// gift to paid + generate the token if the webhook hasn't already fired.
// Then surfaces the gift link the realtor can share or copy.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { verifyGiftPurchase } from "@/app/actions/realtor-gifts";
import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/url-helper";
import { CopyButton } from "./CopyButton";

interface PageProps {
  params: Promise<{ giftId: string }>;
  searchParams: Promise<{ session_id?: string }>;
}

export default async function GiftSuccessPage({ params, searchParams }: PageProps) {
  const { giftId } = await params;
  const { session_id: sessionId } = await searchParams;

  // Trigger the idempotent finalize. Returns immediately if the webhook
  // already did the work.
  if (sessionId) {
    await verifyGiftPurchase(sessionId);
  }

  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const db = getServiceClient();
  const { data: gift } = await db
    .from("tote_rental_gifts")
    .select(
      `id, gift_token, status, recipient_name, recipient_email, tote_count,
       duration_days, amount_cents, realtor_id,
       tote_rental_packages ( name )`
    )
    .eq("id", giftId)
    .single();

  // Ownership check — never let a realtor view someone else's gift detail.
  if (!gift || gift.realtor_id !== user.id) {
    redirect("/realtors/dashboard");
  }

  // If somehow finalize didn't fire yet (no session_id in URL, no webhook
  // yet) we still show a friendly intermediate state.
  const isPaid = gift.status !== "pending_payment" && gift.status !== "cancelled";
  const giftUrl = gift.gift_token ? `${getAppUrl()}/gift/${gift.gift_token}` : null;
  const packageName =
    (gift.tote_rental_packages as unknown as { name: string } | null)?.name || "Closing Gift";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
        <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/10 ring-1 ring-yellow-400/40">
          <CheckCircle2 className="h-7 w-7 text-yellow-400" />
        </div>

        {isPaid ? (
          <>
            <h1 className="mb-3 text-3xl font-black sm:text-4xl">Gift sent.</h1>
            <p className="mb-10 text-base text-stone-400">
              We just emailed <strong className="text-white">{gift.recipient_name}</strong>{" "}
              ({gift.recipient_email}) with the gift link. They&apos;ll verify and pick a
              delivery window from there.
            </p>

            <div className="mb-10 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
                Receipt
              </p>
              <p className="mb-5 text-lg font-bold">{packageName}</p>
              <dl className="space-y-2 text-sm">
                <Row label="Recipient" value={gift.recipient_name as string} />
                <Row label="Email" value={gift.recipient_email as string} />
                <Row label="Totes" value={`${gift.tote_count} totes`} />
                <Row label="Rental window" value={`${gift.duration_days} days`} />
                <Row label="Total charged" value={`$${((gift.amount_cents as number) / 100).toFixed(2)}`} />
              </dl>
            </div>

            {giftUrl && (
              <div className="mb-10 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
                  Gift link
                </p>
                <p className="mb-4 text-sm text-stone-300">
                  Copy this if you want to send it personally over text or DM too.
                </p>
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                  <code className="flex-1 break-all text-xs text-yellow-300">{giftUrl}</code>
                  <CopyButton value={giftUrl} />
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="mb-3 text-3xl font-black sm:text-4xl">Processing your payment&hellip;</h1>
            <p className="mb-10 text-base text-stone-400">
              Stripe is finalizing the charge. Refresh in a few seconds, or head back to
              your dashboard &mdash; the gift will show up there as soon as it&apos;s ready.
            </p>
          </>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/realtors/dashboard/gifts"
            className="rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-yellow-300"
          >
            View all gifts
          </Link>
          <Link
            href="/realtors/dashboard/gifts/new"
            className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-stone-300 hover:border-slate-600"
          >
            Send another
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-2 last:border-0 last:pb-0">
      <dt className="text-stone-400">{label}</dt>
      <dd className="font-medium text-white">{value}</dd>
    </div>
  );
}
