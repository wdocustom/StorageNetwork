import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Box, FileText, Infinity as InfinityIcon } from "lucide-react";
import GiftPlansForm from "@/components/plans/GiftPlansForm";
import { GIFT_MAX_RECIPIENTS, GIFT_UNIT_PRICE, giftPriceLabel } from "@/lib/plan-gifts";

// ═══════════════════════════════════════════════════════════════════════════
// GIFT DIY PLANS — /plans/gift
//
// Buy All-Access tote rack plans for 1–10 people. Each recipient gets their
// own email, link and lifetime access (see @/lib/server/plan-gifts). The
// form and checkout are client-side (GiftPlansForm); this renders the copy.
// ═══════════════════════════════════════════════════════════════════════════

const PRICE = giftPriceLabel(GIFT_UNIT_PRICE);
const DESCRIPTION = `Give DIY tote rack plans as a gift. Each person gets lifetime All-Access: plans for every size they design, a 3D build guide and a printable PDF. ${PRICE} each, emailed instantly.`;

export const metadata: Metadata = {
  title: "Gift DIY Tote Rack Plans | Storage Network",
  description: DESCRIPTION,
  alternates: { canonical: "/plans/gift" },
  openGraph: {
    title: "Give DIY Tote Rack Plans",
    description: DESCRIPTION,
    url: "/plans/gift",
    type: "website",
    siteName: "Storage Network",
  },
};

const PERKS = [
  { icon: InfinityIcon, text: "Plans for every rack they design, for life" },
  { icon: Box, text: "Step-by-step 3D build guide on their phone" },
  { icon: FileText, text: "Printable PDF with cut list and shopping list" },
];

export default function GiftPlansPage() {
  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-stone-300 antialiased">
      <header className="mx-auto flex max-w-xl items-center justify-between px-5 pt-5">
        <Link href="/plans" className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Plans
        </Link>
        <Link href="/" aria-label="Storage Network home">
          <Image src="/landing_page_logo.png" alt="Storage Network" width={84} height={32} className="h-8 w-auto" />
        </Link>
      </header>

      <main className="mx-auto max-w-xl px-5">
        <section className="pb-10 pt-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-400">Give it as a gift</p>
          <h1 className="mt-2 text-[32px] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[40px]">
            Give someone the rack
            <br />
            <span className="text-yellow-400">they keep meaning to build.</span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-stone-400">
            DIY tote rack plans sized to their own wall. {PRICE} per person, emailed to each of them the moment you pay.
          </p>
          <ul className="mt-6 space-y-3">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-stone-200">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10">
                  <Icon className="h-4 w-4 text-yellow-400" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-stone-500">
            For 27-gallon HDX &amp; Greenmade totes. Up to {GIFT_MAX_RECIPIENTS} people per order.
          </p>
        </section>

        <div className="border-t border-white/5 pt-10">
          <GiftPlansForm />
        </div>

        <p className="mt-10 text-center text-sm text-stone-500">
          Want plans for yourself?{" "}
          <Link href="/plans/checkout" className="font-semibold text-stone-300 hover:text-yellow-400">
            Design your own rack
          </Link>
        </p>
      </main>
    </div>
  );
}
