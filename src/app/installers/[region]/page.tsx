import type { Metadata } from "next";
import Link from "next/link";

// ── Region data ──────────────────────────────────────────────────────────
const REGIONS: Record<
  string,
  { label: string; state: string; description: string; zips: string[] }
> = {
  "miami-fl": {
    label: "Miami",
    state: "Florida",
    description:
      "Professional tote rack installation in the Miami metro area. Serving Miami-Dade, Broward, and Palm Beach counties.",
    zips: ["33101", "33125", "33130", "33139", "33142"],
  },
  "orlando-fl": {
    label: "Orlando",
    state: "Florida",
    description:
      "Custom 2×4 tote storage systems built and installed in the Orlando metro area. Serving Orange, Seminole, and Osceola counties.",
    zips: ["32801", "32803", "32806", "32819", "32839"],
  },
  "omaha-ne": {
    label: "Omaha",
    state: "Nebraska",
    description:
      "Garage and basement tote rack installation in the Omaha metro area. Serving Douglas and Sarpy counties.",
    zips: ["68102", "68104", "68106", "68114", "68124"],
  },
  "denver-co": {
    label: "Denver",
    state: "Colorado",
    description:
      "Custom tote storage systems for Denver-area garages, basements, and sheds. Serving the Front Range corridor.",
    zips: ["80202", "80204", "80210", "80220", "80239"],
  },
  "salt-lake-city-ut": {
    label: "Salt Lake City",
    state: "Utah",
    description:
      "Professional tote rack builds along the Wasatch Front. Serving Salt Lake, Davis, and Utah counties.",
    zips: ["84101", "84103", "84106", "84115", "84121"],
  },
  "new-york-ny": {
    label: "New York",
    state: "New York",
    description:
      "Tote storage installation for homes, apartments, and commercial spaces across the New York metro area.",
    zips: ["10001", "10011", "10019", "10128", "11201"],
  },
  "new-jersey-nj": {
    label: "New Jersey",
    state: "New Jersey",
    description:
      "Garage and basement tote rack builds throughout northern and central New Jersey.",
    zips: ["07001", "07030", "07102", "07410", "08501"],
  },
  "pennsylvania-pa": {
    label: "Pennsylvania",
    state: "Pennsylvania",
    description:
      "Custom storage systems for the Philadelphia and eastern PA region.",
    zips: ["19101", "19103", "19106", "19123", "18901"],
  },
};

interface PageProps {
  params: { region: string };
}

export async function generateStaticParams() {
  return Object.keys(REGIONS).map((region) => ({ region }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const region = REGIONS[params.region];
  if (!region) {
    return { title: "Installer Region Not Found | Storage Network" };
  }

  return {
    title: `Tote Rack Installers in ${region.label}, ${region.state} | Storage Network`,
    description: region.description,
    openGraph: {
      title: `Tote Rack Installers in ${region.label}, ${region.state}`,
      description: region.description,
    },
  };
}

export default function InstallerRegionPage({ params }: PageProps) {
  const region = REGIONS[params.region];

  if (!region) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-white">
            Region Not Found
          </h1>
          <Link href="/" className="text-yellow-400 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const localSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Tote Rack Installation in ${region.label}, ${region.state}`,
    url: `https://storage-network.app/installers/${params.region}`,
    provider: { "@id": "https://storage-network.app/#organization" },
    areaServed: {
      "@type": "City",
      name: region.label,
      containedInPlace: { "@type": "State", name: region.state },
    },
    serviceType: "Home Improvement Installation",
    description: region.description,
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "15",
      highPrice: "30",
      priceCurrency: "USD",
      offerCount: "2",
      description:
        "Starting at $15/slot for mini racks and $30/slot for standard 27-gallon tote racks.",
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localSchema) }}
      />

      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold text-white">
            Storage Network
          </Link>
          <Link
            href="/design"
            className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
          >
            Design Your Rack
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-yellow-400">
          {region.state}
        </p>
        <h1 className="mb-6 text-4xl font-black leading-tight text-white sm:text-5xl">
          Tote Rack Installers in{" "}
          <span className="text-yellow-400">{region.label}</span>
        </h1>
        <p className="mb-12 max-w-2xl text-lg leading-relaxed text-stone-400">
          {region.description}
        </p>

        {/* ── What You Get ─────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-bold text-white">
            What Every Installation Includes
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "3D-Designed System",
                desc: "Your rack is configured in our 3D tool before a single board is cut. You see exactly what you're getting.",
              },
              {
                title: "Professional-Grade Build",
                desc: "2×4 framing, 3/4\" plywood rails, star-drive construction screws. Built to hold 27-gallon totes fully loaded.",
              },
              {
                title: "Complete Cut Plan",
                desc: "Optimized lumber cuts with minimal waste. Precise screw counts and material lists — nothing missed.",
              },
              {
                title: "Deposit-Secured Booking",
                desc: "Pay a 15% deposit to lock your date. Balance due on installation day. No surprises.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <h3 className="mb-1 text-sm font-bold text-yellow-400">
                  {item.title}
                </h3>
                <p className="text-sm text-stone-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Service Area ─────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-bold text-white">
            Service Area
          </h2>
          <p className="mb-4 text-base text-stone-400">
            Enter your ZIP code on our{" "}
            <Link href="/" className="text-yellow-400 hover:underline">
              homepage
            </Link>{" "}
            to check if a verified installer covers your area. Sample ZIP codes
            in the {region.label} metro:
          </p>
          <div className="flex flex-wrap gap-2">
            {region.zips.map((z) => (
              <span
                key={z}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-sm font-mono text-stone-400"
              >
                {z}
              </span>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-8 text-center">
          <h2 className="mb-2 text-xl font-bold text-white">
            Get a Custom Rack in {region.label}
          </h2>
          <p className="mb-6 text-stone-400">
            Design your system in 30 seconds and book a verified installer.
          </p>
          <Link
            href="/"
            className="rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
          >
            Check Availability in Your ZIP
          </Link>
        </section>
      </main>
    </div>
  );
}
