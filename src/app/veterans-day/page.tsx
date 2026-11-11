import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { siteConfig } from "@/config/site";
import { generateBreadcrumbJsonLd } from "@/lib/schema/breadcrumb";
import {
  OFFERS,
  OFFER_SOURCES,
  PROOF_OF_SERVICE,
  VETERANS_DAY,
  type Offer,
} from "@/lib/freebies/offers";
import FreebiePlanner from "./FreebiePlanner";

// ═══════════════════════════════════════════════════════════════════════════
// /veterans-day — Veterans Day freebie planner
//
// A thank-you from Storage Network: a veteran enters a ZIP (or shares their
// location) and gets a realistic, timed day of free meals and treats at real
// nearby locations, plus non-food freebies. The static directory below the
// planner lists every offer in the catalog; the plan email's "Offer details"
// buttons link to its #offer-<id> anchors.
// ═══════════════════════════════════════════════════════════════════════════

const TITLE = `Veterans Day ${VETERANS_DAY.year} Freebie Planner | Free Meals Near You`;
const DESCRIPTION =
  "Plan your Veterans Day in under a minute. Enter your ZIP code and get a realistic, timed day of free meals, coffee and treats at real locations near you — plus free haircuts, car washes and military discounts, with directions to every stop.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/veterans-day" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", url: "/veterans-day" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const GROUPS: { title: string; blurb: string; filter: (o: Offer) => boolean }[] = [
  {
    title: "Breakfast",
    blurb: "Start early — Denny's ends at noon.",
    filter: (o) => o.kind === "meal" && !!o.mealSlots?.includes("breakfast"),
  },
  {
    title: "Lunch and dinner",
    blurb: "Most are dine-in. Expect a wait around noon and after 5 p.m.",
    filter: (o) => o.kind === "meal" && !o.mealSlots?.includes("breakfast"),
  },
  {
    title: "Coffee and sweet treats",
    blurb: "Quick stops between meals.",
    filter: (o) => o.kind === "treat",
  },
  {
    title: "Free haircuts, car washes and vouchers",
    blurb: "Not food — and some can be used on a later day.",
    filter: (o) => o.kind === "extra" && o.free,
  },
  {
    title: "Military discounts",
    blurb: "Not free, but worth knowing if you're already out.",
    filter: (o) => o.kind === "extra" && !o.free,
  },
];

function OfferRow({ offer }: { offer: Offer }) {
  return (
    <li id={`offer-${offer.id}`} className="scroll-mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4 target:border-yellow-400">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="text-lg font-black text-white">{offer.brand}</h4>
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{offer.windowNote}</p>
      </div>
      <p className="font-bold text-yellow-300">{offer.headline}</p>
      <p className="mt-2 text-sm leading-relaxed text-stone-300">{offer.details}</p>
      <p className="mt-2 text-sm text-stone-400">
        <span className="font-semibold text-stone-300">Who qualifies:</span> {offer.eligibility}
      </p>
      {offer.redeemLater && <p className="mt-1 text-sm text-stone-300">{offer.redeemLater}</p>}
      <a
        href={offer.website}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm font-semibold text-yellow-300 hover:underline"
      >
        {offer.brand} website ↗
      </a>
    </li>
  );
}

export default function VeteransDayPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbJsonLd([{ name: "Veterans Day Freebie Planner", path: "/veterans-day" }])
          ),
        }}
      />

      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={siteConfig.logoPath} alt="" width={94} height={36} className="h-9 w-auto" />
            <span className="leading-tight">
              <span className="block text-[11px] font-semibold uppercase tracking-widest text-stone-500">
                Provided by
              </span>
              <span className="block text-sm font-bold text-white">Storage Network</span>
            </span>
          </Link>
          <a href="#all-offers" className="text-sm font-semibold text-stone-300 hover:text-white">
            All offers
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:pt-14">
        <section className="mb-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-yellow-400">
            Veterans Day · {VETERANS_DAY.label}
          </p>
          <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">
            Thank you for your service.{" "}
            <span className="text-yellow-400">This one&apos;s on them.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-stone-400">
            Tell us where you are and we&apos;ll plan your day of Veterans Day freebies: breakfast, lunch and
            dinner, a treat or two in between, and the haircuts, car washes and discounts nearby. Real
            locations, real offer hours, a schedule you can actually keep.
          </p>
        </section>

        <FreebiePlanner />

        {/* ── What to bring ───────────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="text-2xl font-black text-white">Bring proof of service</h2>
          <p className="mt-2 text-stone-400">
            Nearly every offer asks for it. Any one of these is usually enough:
          </p>
          <ul className="mt-4 space-y-2">
            {PROOF_OF_SERVICE.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="font-bold text-yellow-400">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-stone-500">
            Offers are for the veteran or service member. Family and guests usually pay regular price unless the
            offer says otherwise.
          </p>
        </section>

        {/* ── Offer directory ─────────────────────────────────────────── */}
        <section id="all-offers" className="mt-16 scroll-mt-6">
          <h2 className="text-2xl font-black text-white">
            Every offer we track for Veterans Day {VETERANS_DAY.year}
          </h2>
          <p className="mt-2 text-stone-400">
            {OFFERS.length} national and regional chains. The planner above only uses these offers, at locations
            it can find near you.
          </p>

          {GROUPS.map((group) => {
            const offers = OFFERS.filter(group.filter);
            if (!offers.length) return null;
            return (
              <div key={group.title} className="mt-8">
                <h3 className="text-lg font-bold text-white">{group.title}</h3>
                <p className="text-sm text-stone-500">{group.blurb}</p>
                <ul className="mt-3 space-y-3">
                  {offers.map((offer) => (
                    <OfferRow key={offer.id} offer={offer} />
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="font-bold text-white">Also worth knowing</h3>
            <p className="mt-1 text-sm leading-relaxed text-stone-300">
              Veterans and Gold Star Families can get a free lifetime pass to national parks and other federal
              recreation lands — good every day of the year, not only on Veterans Day.{" "}
              <a
                href="https://www.nps.gov/planyourvisit/veterans-and-gold-star-families-free-access.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-yellow-300 hover:underline"
              >
                National Park Service details ↗
              </a>
            </p>
          </div>
        </section>

        {/* ── Fine print ──────────────────────────────────────────────── */}
        <section className="mt-16 border-t border-slate-800 pt-8 text-sm leading-relaxed text-stone-500">
          <h2 className="text-base font-bold text-stone-300">How this works, and what to double-check</h2>
          <p className="mt-2">
            Offers were compiled from each chain&apos;s published Veterans Day {VETERANS_DAY.year} announcement
            and are valid on {VETERANS_DAY.label} unless noted. They apply at participating locations, can
            change or run out, and franchise stores sometimes opt out — a quick call to the store is the surest
            way to confirm. Locations come from OpenStreetMap. Arrival times are estimates from typical drive
            times and do not account for traffic or lines.
          </p>
          <p className="mt-3">Sources:</p>
          <ul className="mt-1 space-y-1">
            {OFFER_SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-white hover:underline">
                  {s.name} ↗
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Storage Network is not affiliated with these businesses or with the Department of Veterans Affairs.
            Location data © OpenStreetMap contributors.
          </p>
        </section>

        <section className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
          <p className="text-lg font-bold text-white">From all of us at Storage Network — thank you.</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-stone-400">
            We build custom tote storage racks for garages and basements, installed by local pros across the
            country.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-yellow-300 hover:underline">
            Visit storage-network.app
          </Link>
        </section>
      </main>
    </div>
  );
}
