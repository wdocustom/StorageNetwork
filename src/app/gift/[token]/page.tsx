// ═══════════════════════════════════════════════════════════════════════════
// Recipient Gift Page — /gift/[token]
//
// Public, unauthenticated, token-as-credential entry point. Three states:
//   1. Locked  — show package details + brand context, prompt for magic code
//   2. Redeemed but not scheduled — show scheduling form
//   3. Scheduled — show delivery + pickup windows on a confirmation card
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Image from "next/image";
import { Gift, Package as PackageIcon, Check } from "lucide-react";

import { lookupGiftByToken } from "@/app/actions/realtor-gifts";
import { GiftRecipientFlow } from "./GiftRecipientFlow";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function GiftRecipientPage({ params }: PageProps) {
  const { token } = await params;
  const gift = await lookupGiftByToken(token);
  if (!gift) notFound();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <div className="mb-8 flex items-center gap-3">
          <Image
            src="/landing_page_logo.png"
            alt="Storage Network"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
          />
          <span className="text-sm font-bold tracking-tight text-stone-300">Storage Network</span>
        </div>

        {/* ── Brand banner — co-branded with the realtor.
            Three optional layers (all set via /realtors/dashboard/settings):
              - Photo: circular head-shot above the eyebrow line.
              - Logo:  small badge next to the brokerage name.
              - Signature: italic closing line that falls back ONLY when
                no per-gift personalMessage was supplied — the per-gift
                note always wins because it's contextual to this recipient.
            Each layer renders only when its field is set; with none set,
            the banner is text-only, matching the pre-branding behavior. */}
        <div className="mb-10 rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-6 text-center">
          {gift.realtorPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gift.realtorPhotoUrl}
              alt={gift.realtorName}
              className="mx-auto mb-4 h-20 w-20 rounded-full border-2 border-yellow-400/40 object-cover"
            />
          )}
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            A closing gift for {gift.recipientName.split(" ")[0]}
          </p>
          <h1 className="mb-1 text-2xl font-black sm:text-3xl">
            From {gift.realtorName}
          </h1>
          {(gift.realtorBrokerage || gift.realtorLogoUrl) && (
            <div className="mt-1 flex items-center justify-center gap-2 text-sm text-stone-400">
              {gift.realtorLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={gift.realtorLogoUrl}
                  alt={gift.realtorBrokerage || "Brokerage logo"}
                  className="h-6 w-auto max-w-[5rem] object-contain"
                />
              )}
              {gift.realtorBrokerage && <span>{gift.realtorBrokerage}</span>}
            </div>
          )}
          {gift.personalMessage ? (
            <p className="mt-5 max-w-xl mx-auto text-base italic leading-relaxed text-stone-200">
              &ldquo;{gift.personalMessage}&rdquo;
            </p>
          ) : gift.realtorSignature ? (
            <p className="mt-5 max-w-xl mx-auto text-base italic leading-relaxed text-stone-200">
              &ldquo;{gift.realtorSignature}&rdquo;
            </p>
          ) : null}
        </div>

        {/* ── Package details — always visible ──────────────────────── */}
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/30">
              <Gift className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-lg font-bold">{gift.packageName}</p>
              <p className="text-xs text-stone-400">
                {gift.toteCount} reusable totes &middot; {gift.durationDays}-day rental
              </p>
            </div>
          </div>

          {gift.packageDescription && (
            <p className="mb-6 text-sm leading-relaxed text-stone-300">{gift.packageDescription}</p>
          )}

          {gift.features.length > 0 && (
            <ul className="space-y-2">
              {gift.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-stone-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── State-dependent interaction (magic-code → scheduling) ── */}
        <GiftRecipientFlow token={token} gift={gift} />

        {/* ── Footer reassurance ───────────────────────────────────── */}
        <div className="mt-10 flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-xs text-stone-500">
          <PackageIcon className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
          <p>
            Reusable totes are delivered and picked up by a local pro from the Storage
            Network installer network. No cardboard ever leaves your house.
          </p>
        </div>
      </div>
    </div>
  );
}
