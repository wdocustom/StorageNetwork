import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, FileText, Gift, Infinity as InfinityIcon } from "lucide-react";
import { loadGiftWelcome } from "@/app/actions/plan-gifts";
import { ResendLinkPanel } from "@/components/plans/PlansStorefront";
import GiftOpenedBeacon from "@/components/plans/GiftOpenedBeacon";

// ═══════════════════════════════════════════════════════════════════════════
// /plans/gift/open?token=…: where a gift email lands
//
// Who it's from, their note, and two ways in: design your own rack (the
// designer in All-Access "included" mode) or open the starter plan. Plan
// access itself is still device-gated on the plan pages; this page only
// shows the gifter's name and note.
// ═══════════════════════════════════════════════════════════════════════════

const STEPS = [
  { icon: Box, title: "Design it", text: "Set the size to fit your wall, pick your totes and options." },
  { icon: FileText, title: "Get the plan", text: "Cut list, shopping list and every step, instantly. Included." },
  { icon: InfinityIcon, title: "Build more", text: "Every rack you design after that is included too, for life." },
];

export default async function GiftOpenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token: raw } = await searchParams;
  const token = typeof raw === "string" && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
  const gift = token ? await loadGiftWelcome(token) : null;

  return (
    <div className="min-h-screen bg-slate-950 pb-16 text-stone-300 antialiased">
      <header className="mx-auto flex max-w-xl items-center justify-center px-5 pt-5">
        <Link href="/plans" aria-label="Storage Network plans">
          <Image src="/landing_page_logo.png" alt="Storage Network" width={84} height={32} className="h-8 w-auto" />
        </Link>
      </header>

      <main className="mx-auto max-w-xl px-5">
        {!gift || !token ? (
          <section className="py-14 text-center">
            <Gift className="mx-auto h-10 w-10 text-stone-500" aria-hidden />
            <h1 className="mt-4 text-2xl font-extrabold text-white">This gift link isn&apos;t working</h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] text-stone-400">
              It may have been replaced with a newer one. Enter the email the gift was sent to and we&apos;ll send you your
              current link.
            </p>
            <div className="mt-8 text-left">
              <ResendLinkPanel />
            </div>
          </section>
        ) : (
          <>
            <GiftOpenedBeacon token={token} />
            <section className="pb-10 pt-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/15">
                <Gift className="h-7 w-7 text-yellow-400" aria-hidden />
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-yellow-400">A gift from {gift.gifterName}</p>
              <h1 className="mt-2 text-[30px] font-extrabold leading-[1.12] tracking-tight text-white sm:text-4xl">
                {gift.recipientFirstName ? `${gift.recipientFirstName}, your` : "Your"} DIY tote rack plans are ready.
              </h1>
              <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-stone-400">
                Lifetime All-Access: design a rack sized to your wall and build it with a step-by-step 3D guide. Nothing to pay.
              </p>
            </section>

            {gift.message && (
              <figure className="rounded-2xl border-l-4 border-yellow-400 bg-slate-900 px-5 py-4">
                <blockquote className="whitespace-pre-line text-[16px] leading-relaxed text-stone-100">{gift.message}</blockquote>
                <figcaption className="mt-2 text-sm text-stone-500">— {gift.gifterName}</figcaption>
              </figure>
            )}

            <section className="mt-8">
              <Link
                href={gift.designHref}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 py-4 text-base font-extrabold text-gray-950 transition hover:bg-yellow-300 active:scale-[0.99]"
              >
                Design my rack <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <Link
                href={gift.starterHref}
                className="mt-3 flex w-full items-center justify-center rounded-2xl border border-slate-700 py-3.5 text-[15px] font-bold text-stone-200 transition hover:bg-slate-900"
              >
                Or open a starter 4×4 plan
              </Link>
              <p className="mt-3 text-center text-sm text-stone-500">
                All your plans stay in{" "}
                <Link href={gift.libraryHref} className="font-semibold text-stone-300 hover:text-yellow-400">
                  My Builds
                </Link>
                .
              </p>
            </section>

            <section className="mt-12 border-t border-white/5 pt-10">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-400">How it works</p>
              <ol className="mt-6 space-y-6">
                {STEPS.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10">
                      <Icon className="h-4 w-4 text-yellow-400" aria-hidden />
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-white">{title}</h2>
                      <p className="mt-0.5 text-[15px] text-stone-400">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-8 rounded-xl bg-slate-900 p-4 text-sm leading-relaxed text-stone-400">
                Opening your plans on another phone or computer later? We&apos;ll email a quick code to the address this gift was
                sent to, so only you can use it. Keep the gift email: its link is yours for good.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
