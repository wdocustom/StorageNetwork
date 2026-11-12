import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { siteConfig } from "@/config/site";
import { generateBreadcrumbJsonLd } from "@/lib/schema/breadcrumb";
import { nextVeteransDayYear } from "@/lib/freebies/veterans-day-date";
import VeteransDayCountdown from "./VeteransDayCountdown";

// ═══════════════════════════════════════════════════════════════════════════
// /veterans-day — between Veterans Days: a countdown to the next one
//
// A thank-you from Storage Network. Outside the season the page is just a
// banner: countdown to November 11, add-to-calendar and bookmark.
//
// The freebie planner itself (FreebiePlanner.tsx, src/lib/freebies/, the
// /api/veterans-day/* routes and public/freebies/locations/) is kept for
// next year. To bring it back: refresh the offers in
// src/lib/freebies/offers.ts, rebuild the locations with
// scripts/freebies/build-locations.mjs, and render <FreebiePlanner /> here
// again (see git history for the full page).
// ═══════════════════════════════════════════════════════════════════════════

const TITLE = "Veterans Day Countdown | Free Meals & Discounts for Veterans";
const DESCRIPTION =
  "Countdown to Veterans Day, November 11. Add it to your calendar and come back to plan your day of free meals, coffee, haircuts, car washes and military discounts, with directions to every stop.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/veterans-day" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", url: "/veterans-day" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// The year in the server's calendar; the banner switches to the visitor's
// own clock once it loads.
export const revalidate = 3600;

export default function VeteransDayPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateBreadcrumbJsonLd([{ name: "Veterans Day", path: "/veterans-day" }])),
        }}
      />

      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={siteConfig.logoPath} alt="" width={94} height={36} className="h-9 w-auto" />
            <span className="leading-tight">
              <span className="block text-[11px] font-semibold uppercase tracking-widest text-stone-500">
                Provided by
              </span>
              <span className="block text-sm font-bold text-white">Storage Network</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col justify-center px-4 py-10 sm:py-16">
        <VeteransDayCountdown serverYear={nextVeteransDayYear(new Date(), true)} />
      </main>
    </div>
  );
}
