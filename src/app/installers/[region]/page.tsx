import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getInstallerDerivedRegions,
  getInstallersForRegionSlug,
  primaryZipForRegion,
  parseRegionSlug,
  fullStateName,
  regionSlug as buildRegionSlug,
  type RegionInstaller,
} from "@/lib/server/region-pages";

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

  // ── 50 Additional Major Metro Areas ──────────────────────────────────────
  // Selected for high homeownership, suburban garage/basement prevalence,
  // family household size, and growing metro populations.

  "atlanta-ga": {
    label: "Atlanta",
    state: "Georgia",
    description:
      "Custom tote storage systems for Atlanta-area garages and basements. Serving Fulton, DeKalb, Cobb, and Gwinnett counties across the metro.",
    zips: ["30301", "30305", "30309", "30318", "30324", "30328", "30338", "30344"],
  },
  "charlotte-nc": {
    label: "Charlotte",
    state: "North Carolina",
    description:
      "Professional tote rack installation across the Charlotte metro. Serving Mecklenburg, Union, Cabarrus, and Gaston counties.",
    zips: ["28202", "28205", "28210", "28226", "28269", "28277", "28105", "28078"],
  },
  "raleigh-nc": {
    label: "Raleigh",
    state: "North Carolina",
    description:
      "Garage and bonus-room tote storage for the Research Triangle. Serving Wake, Durham, and Orange counties.",
    zips: ["27601", "27604", "27607", "27610", "27615", "27703", "27560", "27513"],
  },
  "nashville-tn": {
    label: "Nashville",
    state: "Tennessee",
    description:
      "Custom 2×4 tote racks built and installed across the Nashville metro. Serving Davidson, Williamson, and Rutherford counties.",
    zips: ["37201", "37203", "37206", "37209", "37215", "37027", "37064", "37067"],
  },
  "dallas-tx": {
    label: "Dallas",
    state: "Texas",
    description:
      "Tote storage systems for Dallas-area garages. Serving Dallas, Collin, Denton, and Tarrant counties.",
    zips: ["75201", "75204", "75214", "75225", "75243", "75024", "75034", "75070"],
  },
  "fort-worth-tx": {
    label: "Fort Worth",
    state: "Texas",
    description:
      "Professional tote rack installation across Fort Worth and the western DFW metro. Serving Tarrant, Parker, and Johnson counties.",
    zips: ["76102", "76107", "76109", "76116", "76132", "76137", "76244", "76148"],
  },
  "houston-tx": {
    label: "Houston",
    state: "Texas",
    description:
      "Custom tote storage for the greater Houston area. Serving Harris, Fort Bend, Montgomery, and Brazoria counties.",
    zips: ["77002", "77007", "77019", "77024", "77056", "77494", "77386", "77479"],
  },
  "san-antonio-tx": {
    label: "San Antonio",
    state: "Texas",
    description:
      "Garage and utility-room tote rack builds across San Antonio. Serving Bexar, Comal, and Guadalupe counties.",
    zips: ["78201", "78205", "78209", "78216", "78229", "78240", "78247", "78258"],
  },
  "austin-tx": {
    label: "Austin",
    state: "Texas",
    description:
      "Custom tote storage systems for Austin-area homes. Serving Travis, Williamson, and Hays counties along the I-35 corridor.",
    zips: ["78701", "78704", "78731", "78745", "78759", "78681", "78664", "78660"],
  },
  "phoenix-az": {
    label: "Phoenix",
    state: "Arizona",
    description:
      "Tote rack installation across the Phoenix metro and East Valley. Serving Maricopa County including Mesa, Chandler, Gilbert, and Tempe.",
    zips: ["85003", "85006", "85013", "85018", "85028", "85044", "85224", "85233"],
  },
  "scottsdale-az": {
    label: "Scottsdale",
    state: "Arizona",
    description:
      "Premium tote storage systems for Scottsdale and Paradise Valley homes. Oversized garage builds for the North Scottsdale corridor.",
    zips: ["85250", "85251", "85254", "85258", "85260", "85262", "85266", "85255"],
  },
  "tampa-fl": {
    label: "Tampa",
    state: "Florida",
    description:
      "Custom tote rack builds across Tampa Bay. Serving Hillsborough, Pinellas, and Pasco counties.",
    zips: ["33602", "33606", "33609", "33614", "33629", "33647", "33701", "33716"],
  },
  "jacksonville-fl": {
    label: "Jacksonville",
    state: "Florida",
    description:
      "Professional tote storage installation across Jacksonville and the First Coast. Serving Duval, St. Johns, Clay, and Nassau counties.",
    zips: ["32202", "32207", "32210", "32225", "32246", "32256", "32082", "32095"],
  },
  "indianapolis-in": {
    label: "Indianapolis",
    state: "Indiana",
    description:
      "Garage and basement tote rack installation in the Indianapolis metro. Serving Marion, Hamilton, Hendricks, and Johnson counties.",
    zips: ["46201", "46204", "46220", "46226", "46240", "46032", "46062", "46143"],
  },
  "columbus-oh": {
    label: "Columbus",
    state: "Ohio",
    description:
      "Custom tote storage systems for Columbus-area garages and basements. Serving Franklin, Delaware, and Licking counties.",
    zips: ["43201", "43204", "43210", "43215", "43235", "43016", "43065", "43017"],
  },
  "cincinnati-oh": {
    label: "Cincinnati",
    state: "Ohio",
    description:
      "Professional tote rack builds across the Cincinnati tri-state area. Serving Hamilton, Butler, Warren, and Clermont counties.",
    zips: ["45202", "45208", "45219", "45236", "45241", "45069", "45040", "45011"],
  },
  "cleveland-oh": {
    label: "Cleveland",
    state: "Ohio",
    description:
      "Basement and garage tote storage for Greater Cleveland. Serving Cuyahoga, Lake, Lorain, and Summit counties.",
    zips: ["44101", "44106", "44111", "44114", "44124", "44133", "44060", "44017"],
  },
  "minneapolis-mn": {
    label: "Minneapolis",
    state: "Minnesota",
    description:
      "Basement tote rack systems for the Twin Cities metro. Serving Hennepin, Ramsey, Dakota, and Anoka counties.",
    zips: ["55401", "55404", "55408", "55416", "55426", "55104", "55113", "55337"],
  },
  "st-louis-mo": {
    label: "St. Louis",
    state: "Missouri",
    description:
      "Custom tote storage for the greater St. Louis area. Serving St. Louis City, St. Louis County, St. Charles, and Jefferson counties.",
    zips: ["63101", "63104", "63108", "63118", "63139", "63017", "63301", "63021"],
  },
  "kansas-city-mo": {
    label: "Kansas City",
    state: "Missouri",
    description:
      "Professional tote rack installation across the KC metro. Serving Jackson, Clay, and Platte counties in Missouri and Johnson County in Kansas.",
    zips: ["64101", "64108", "64110", "64114", "64131", "66061", "66062", "66204"],
  },
  "milwaukee-wi": {
    label: "Milwaukee",
    state: "Wisconsin",
    description:
      "Basement and garage tote storage for the Milwaukee metro. Serving Milwaukee, Waukesha, Ozaukee, and Washington counties.",
    zips: ["53202", "53207", "53215", "53222", "53227", "53005", "53045", "53051"],
  },
  "detroit-mi": {
    label: "Detroit",
    state: "Michigan",
    description:
      "Custom tote rack systems for metro Detroit garages and basements. Serving Wayne, Oakland, Macomb, and Washtenaw counties.",
    zips: ["48201", "48204", "48207", "48214", "48226", "48075", "48009", "48336"],
  },
  "grand-rapids-mi": {
    label: "Grand Rapids",
    state: "Michigan",
    description:
      "Tote storage builds for the Grand Rapids area. Serving Kent, Ottawa, and Muskegon counties across West Michigan.",
    zips: ["49503", "49506", "49512", "49525", "49534", "49418", "49301", "49315"],
  },
  "louisville-ky": {
    label: "Louisville",
    state: "Kentucky",
    description:
      "Custom tote rack installation across the Louisville metro. Serving Jefferson, Oldham, and Bullitt counties.",
    zips: ["40202", "40204", "40207", "40214", "40220", "40222", "40241", "40245"],
  },
  "memphis-tn": {
    label: "Memphis",
    state: "Tennessee",
    description:
      "Garage tote storage systems for the Memphis metro. Serving Shelby, Tipton, and Fayette counties.",
    zips: ["38103", "38111", "38117", "38120", "38125", "38134", "38138", "38018"],
  },
  "richmond-va": {
    label: "Richmond",
    state: "Virginia",
    description:
      "Custom tote rack builds for the greater Richmond area. Serving Richmond City, Henrico, Chesterfield, and Hanover counties.",
    zips: ["23219", "23220", "23225", "23229", "23233", "23060", "23112", "23059"],
  },
  "virginia-beach-va": {
    label: "Virginia Beach",
    state: "Virginia",
    description:
      "Professional tote storage for Hampton Roads. Serving Virginia Beach, Norfolk, Chesapeake, and Newport News.",
    zips: ["23451", "23452", "23454", "23456", "23462", "23320", "23505", "23602"],
  },
  "charleston-sc": {
    label: "Charleston",
    state: "South Carolina",
    description:
      "Tote rack installation across the Charleston Lowcountry. Serving Charleston, Berkeley, and Dorchester counties.",
    zips: ["29401", "29403", "29407", "29412", "29414", "29464", "29485", "29456"],
  },
  "greenville-sc": {
    label: "Greenville",
    state: "South Carolina",
    description:
      "Custom tote storage for the Greenville-Spartanburg Upstate region. Serving Greenville, Spartanburg, and Anderson counties.",
    zips: ["29601", "29605", "29607", "29609", "29615", "29650", "29681", "29301"],
  },
  "boise-id": {
    label: "Boise",
    state: "Idaho",
    description:
      "Garage tote rack systems for the Treasure Valley. Serving Ada, Canyon, and Gem counties across the Boise metro.",
    zips: ["83701", "83702", "83704", "83706", "83709", "83713", "83616", "83646"],
  },
  "portland-or": {
    label: "Portland",
    state: "Oregon",
    description:
      "Custom tote storage for the Portland metro. Serving Multnomah, Washington, and Clackamas counties.",
    zips: ["97201", "97205", "97209", "97214", "97232", "97005", "97034", "97068"],
  },
  "seattle-wa": {
    label: "Seattle",
    state: "Washington",
    description:
      "Professional tote rack installation across the Puget Sound region. Serving King, Snohomish, and Pierce counties.",
    zips: ["98101", "98103", "98107", "98115", "98199", "98004", "98052", "98033"],
  },
  "sacramento-ca": {
    label: "Sacramento",
    state: "California",
    description:
      "Tote storage systems for Sacramento-area garages. Serving Sacramento, Placer, El Dorado, and Yolo counties.",
    zips: ["95811", "95814", "95816", "95822", "95833", "95661", "95630", "95762"],
  },
  "las-vegas-nv": {
    label: "Las Vegas",
    state: "Nevada",
    description:
      "Custom tote rack builds for the Las Vegas Valley. Serving Clark County including Henderson, North Las Vegas, and Summerlin.",
    zips: ["89101", "89107", "89117", "89128", "89135", "89012", "89002", "89031"],
  },
  "tucson-az": {
    label: "Tucson",
    state: "Arizona",
    description:
      "Garage tote storage for the Tucson metro. Serving Pima County including Marana, Oro Valley, and Sahuarita.",
    zips: ["85701", "85710", "85711", "85718", "85741", "85742", "85748", "85737"],
  },
  "albuquerque-nm": {
    label: "Albuquerque",
    state: "New Mexico",
    description:
      "Professional tote rack installation across Albuquerque and the Rio Grande Valley. Serving Bernalillo and Sandoval counties.",
    zips: ["87101", "87106", "87110", "87114", "87120", "87122", "87123", "87144"],
  },
  "oklahoma-city-ok": {
    label: "Oklahoma City",
    state: "Oklahoma",
    description:
      "Custom tote storage systems for the OKC metro. Serving Oklahoma, Cleveland, and Canadian counties.",
    zips: ["73101", "73102", "73107", "73112", "73120", "73013", "73034", "73003"],
  },
  "tulsa-ok": {
    label: "Tulsa",
    state: "Oklahoma",
    description:
      "Tote rack installation for Tulsa-area garages and workshops. Serving Tulsa, Creek, Rogers, and Wagoner counties.",
    zips: ["74101", "74104", "74105", "74114", "74136", "74012", "74055", "74008"],
  },
  "des-moines-ia": {
    label: "Des Moines",
    state: "Iowa",
    description:
      "Basement and garage tote storage for the Des Moines metro. Serving Polk, Dallas, and Warren counties.",
    zips: ["50309", "50310", "50315", "50317", "50312", "50023", "50131", "50263"],
  },
  "knoxville-tn": {
    label: "Knoxville",
    state: "Tennessee",
    description:
      "Custom tote rack builds for the Knoxville area. Serving Knox, Blount, Anderson, and Loudon counties.",
    zips: ["37902", "37909", "37914", "37919", "37922", "37934", "37801", "37830"],
  },
  "huntsville-al": {
    label: "Huntsville",
    state: "Alabama",
    description:
      "Professional tote storage for the Huntsville-Decatur metro. Serving Madison, Limestone, and Morgan counties.",
    zips: ["35801", "35802", "35805", "35806", "35811", "35758", "35749", "35756"],
  },
  "birmingham-al": {
    label: "Birmingham",
    state: "Alabama",
    description:
      "Custom tote rack installation across the Birmingham metro. Serving Jefferson, Shelby, and St. Clair counties.",
    zips: ["35203", "35205", "35209", "35213", "35216", "35244", "35242", "35007"],
  },
  "san-diego-ca": {
    label: "San Diego",
    state: "California",
    description:
      "Tote storage systems for San Diego County garages. Serving coastal and inland communities from La Jolla to El Cajon.",
    zips: ["92101", "92103", "92107", "92117", "92126", "92131", "92071", "92020"],
  },
  "colorado-springs-co": {
    label: "Colorado Springs",
    state: "Colorado",
    description:
      "Custom tote rack builds for the Colorado Springs area. Serving El Paso and Teller counties along the Front Range.",
    zips: ["80901", "80903", "80907", "80917", "80920", "80922", "80925", "80132"],
  },
  "spokane-wa": {
    label: "Spokane",
    state: "Washington",
    description:
      "Garage and basement tote storage for the Spokane metro. Serving Spokane and Kootenai counties in the Inland Northwest.",
    zips: ["99201", "99203", "99205", "99208", "99223", "99004", "99016", "99019"],
  },
  "provo-ut": {
    label: "Provo",
    state: "Utah",
    description:
      "Tote rack systems for Utah County's family-sized homes. Serving Provo, Orem, Lehi, and Spanish Fork along the Wasatch Front.",
    zips: ["84601", "84604", "84606", "84043", "84057", "84660", "84097", "84003"],
  },
  "bakersfield-ca": {
    label: "Bakersfield",
    state: "California",
    description:
      "Professional tote storage for Bakersfield-area homes. Serving Kern County with spacious garage and workshop builds.",
    zips: ["93301", "93304", "93306", "93309", "93312", "93313", "93311", "93314"],
  },
  "reno-nv": {
    label: "Reno",
    state: "Nevada",
    description:
      "Custom tote rack installation for the Reno-Sparks metro. Serving Washoe County and the Truckee Meadows region.",
    zips: ["89501", "89502", "89503", "89509", "89511", "89431", "89434", "89436"],
  },
  "wichita-ks": {
    label: "Wichita",
    state: "Kansas",
    description:
      "Garage tote storage systems for the Wichita area. Serving Sedgwick, Butler, and Harvey counties in south-central Kansas.",
    zips: ["67201", "67203", "67207", "67212", "67226", "67230", "67235", "67052"],
  },
  "little-rock-ar": {
    label: "Little Rock",
    state: "Arkansas",
    description:
      "Custom tote rack builds for the Little Rock metro. Serving Pulaski, Saline, and Faulkner counties in central Arkansas.",
    zips: ["72201", "72204", "72205", "72207", "72211", "72223", "72002", "72022"],
  },
};

interface PageProps {
  params: { region: string };
}

// Refresh dynamic page contents (installer rosters, new cities) hourly. New
// city slugs from installers who just joined render on-demand on first hit.
export const revalidate = 3600;
export const dynamicParams = true;

interface ResolvedRegion {
  slug: string;
  label: string;
  state: string;
  description: string;
  zips: string[];
  isCurated: boolean;
}

async function resolveRegion(slug: string): Promise<ResolvedRegion | null> {
  const curated = REGIONS[slug];
  if (curated) {
    return {
      slug,
      label: curated.label,
      state: curated.state,
      description: curated.description,
      zips: curated.zips,
      isCurated: true,
    };
  }

  const parsed = parseRegionSlug(slug);
  if (!parsed) return null;

  const installers = await getInstallersForRegionSlug(slug, 1);
  if (installers.length === 0) return null;

  const cityLabel = parsed.citySlugPart
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
  const stateLabel = fullStateName(parsed.stateCode);
  return {
    slug,
    label: cityLabel,
    state: stateLabel,
    description: `Custom 2×4 tote storage racks built and installed in the ${cityLabel}, ${parsed.stateCode.toUpperCase()} metro by verified Storage Network installers.`,
    zips: (installers[0].service_zips ?? []).slice(0, 6),
    isCurated: false,
  };
}

// Cap prerender at curated 58 + top 100 dynamic cities (by installer count).
// Every other city still works — it renders on-demand via ISR (dynamicParams)
// on first visit and is cached by Vercel after that, AND it appears in the
// sitemap. This keeps the build time roughly constant as installer rosters
// grow instead of scaling linearly with the network's coverage footprint.
const DYNAMIC_PRERENDER_CAP = 100;

export async function generateStaticParams() {
  const curated = Object.keys(REGIONS);
  const dynamic = await getInstallerDerivedRegions(DYNAMIC_PRERENDER_CAP).catch(
    () => [],
  );
  const all = new Set<string>(curated);
  for (const c of dynamic) all.add(buildRegionSlug(c.city, c.stateCode));
  return Array.from(all).map((region) => ({ region }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const region = await resolveRegion(params.region);
  if (!region) {
    return { title: "Installer Region Not Found | Storage Network" };
  }

  return {
    title: `Tote Rack Installers in ${region.label}, ${region.state} | Storage Network`,
    description: region.description,
    alternates: {
      canonical: `/installers/${region.slug}`,
    },
    openGraph: {
      title: `Tote Rack Installers in ${region.label}, ${region.state}`,
      description: region.description,
    },
  };
}

function installerDisplayName(installer: RegionInstaller): string {
  return (
    installer.business_name ||
    [installer.first_name, installer.last_name].filter(Boolean).join(" ") ||
    "A verified installer"
  );
}

function designUrl(installer: RegionInstaller, zip: string | null): string {
  const params = new URLSearchParams({ from: "network" });
  params.set("installer_id", installer.id);
  if (zip) params.set("zip", zip);
  return `/design?${params.toString()}`;
}

export default async function InstallerRegionPage({ params }: PageProps) {
  const region = await resolveRegion(params.region);

  // notFound() emits a real 404 response. The previous render returned a
  // "Region Not Found" body with HTTP 200, which Google flagged as a Soft
  // 404 — surfacing on GSC and pulling crawl budget away from real pages.
  if (!region) notFound();

  const installers = await getInstallersForRegionSlug(region.slug, 3);
  const primaryInstaller = installers[0] ?? null;
  const primaryZip =
    primaryZipForRegion(region.slug, installers) ?? region.zips[0] ?? null;
  const primaryCtaHref = primaryInstaller
    ? designUrl(primaryInstaller, primaryZip)
    : primaryZip
      ? `/design?zip=${encodeURIComponent(primaryZip)}&from=network`
      : "/design?from=network";

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
            href={primaryCtaHref}
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

        {/* ── Installers serving this area ──────────────────────────── */}
        {installers.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-white">
              {installers.length === 1
                ? `Your installer in ${region.label}`
                : `Installers serving ${region.label}`}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {installers.map((installer, idx) => {
                const name = installerDisplayName(installer);
                const isPrimary = idx === 0;
                return (
                  <div
                    key={installer.id}
                    className={`flex flex-col rounded-xl border p-5 ${
                      isPrimary
                        ? "border-yellow-400/40 bg-yellow-400/5"
                        : "border-slate-800 bg-slate-900"
                    }`}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      {installer.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={installer.avatar_url}
                          alt={name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-yellow-400">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-white">{name}</p>
                        <p className="text-[11px] text-stone-500">
                          {installer.completed_jobs ?? 0} jobs completed
                          {isPrimary && installers.length > 1 ? " · Top match" : ""}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={designUrl(installer, primaryZip)}
                      className={`mt-auto rounded-lg px-3 py-2 text-center text-xs font-bold transition-colors ${
                        isPrimary
                          ? "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                          : "border border-slate-700 text-stone-300 hover:border-yellow-400 hover:text-yellow-400"
                      }`}
                    >
                      Design with {name.split(" ")[0]}
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Service Area ─────────────────────────────────────────── */}
        {region.zips.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-white">
              Service Area
            </h2>
            <p className="mb-4 text-base text-stone-400">
              {region.label} ZIP codes already covered by a verified installer:
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
        )}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-8 text-center">
          <h2 className="mb-2 text-xl font-bold text-white">
            Get a Custom Rack in {region.label}
          </h2>
          <p className="mb-6 text-stone-400">
            {primaryInstaller
              ? `Skip the ZIP form — your design opens pre-attached to ${installerDisplayName(primaryInstaller)}.`
              : "Design your system in 30 seconds and book a verified installer."}
          </p>
          <Link
            href={primaryCtaHref}
            className="rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
          >
            {primaryInstaller ? "Design My Storage" : "Check Availability in Your ZIP"}
          </Link>
        </section>
      </main>
    </div>
  );
}
