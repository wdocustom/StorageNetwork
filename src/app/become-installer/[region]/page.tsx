import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

// ═══════════════════════════════════════════════════════════════════════════
// Become an Installer — Location-specific landing pages
//
// High-conversion pages targeting installers in specific metro areas.
// Routes to /join for signup, /demo for booking a call.
// ═══════════════════════════════════════════════════════════════════════════

// ── Region data ──────────────────────────────────────────────────────────
const REGIONS: Record<
  string,
  {
    label: string;
    state: string;
    description: string;
    zips: string[];
    avgHomes: string;
    marketNote: string;
  }
> = {
  "miami-fl": {
    label: "Miami",
    state: "Florida",
    description:
      "Join the Storage Network as an installer in the Miami metro area. Serve homeowners across Miami-Dade, Broward, and Palm Beach counties.",
    zips: ["33101", "33125", "33130", "33139", "33142"],
    avgHomes: "950K+",
    marketNote:
      "South Florida's booming housing market means homeowners are constantly looking for garage and storage upgrades.",
  },
  "orlando-fl": {
    label: "Orlando",
    state: "Florida",
    description:
      "Become a tote rack installer in the Orlando metro. Cover Orange, Seminole, and Osceola counties with pre-sold jobs.",
    zips: ["32801", "32803", "32806", "32819", "32839"],
    avgHomes: "600K+",
    marketNote:
      "Orlando's rapid suburban growth creates massive demand for organized garage storage.",
  },
  "omaha-ne": {
    label: "Omaha",
    state: "Nebraska",
    description:
      "Install tote rack systems for homeowners across the Omaha metro. Serve Douglas and Sarpy counties.",
    zips: ["68102", "68104", "68106", "68114", "68124"],
    avgHomes: "250K+",
    marketNote:
      "Midwest homes with large basements and garages are perfect for tote storage systems.",
  },
  "denver-co": {
    label: "Denver",
    state: "Colorado",
    description:
      "Join the installer network in Denver. Build tote storage systems across the Front Range corridor.",
    zips: ["80202", "80204", "80210", "80220", "80239"],
    avgHomes: "700K+",
    marketNote:
      "Denver's outdoor lifestyle means garages are overflowing — homeowners need organized storage solutions.",
  },
  "salt-lake-city-ut": {
    label: "Salt Lake City",
    state: "Utah",
    description:
      "Become an installer along the Wasatch Front. Serve homeowners in Salt Lake, Davis, and Utah counties.",
    zips: ["84101", "84103", "84106", "84115", "84121"],
    avgHomes: "450K+",
    marketNote:
      "Large family households along the Wasatch Front need serious storage — and they're willing to pay for it.",
  },
  "new-york-ny": {
    label: "New York",
    state: "New York",
    description:
      "Install tote storage systems across the New York metro area. Homes, apartments, and commercial spaces.",
    zips: ["10001", "10011", "10019", "10128", "11201"],
    avgHomes: "3M+",
    marketNote:
      "Space is at a premium in the NYC metro — organized storage is a high-demand service.",
  },
  "new-jersey-nj": {
    label: "New Jersey",
    state: "New Jersey",
    description:
      "Join the network in New Jersey. Build tote racks across northern and central NJ.",
    zips: ["07001", "07030", "07102", "07410", "08501"],
    avgHomes: "1.2M+",
    marketNote:
      "Dense suburban communities with garages and basements create consistent demand for storage builds.",
  },
  "pennsylvania-pa": {
    label: "Pennsylvania",
    state: "Pennsylvania",
    description:
      "Become an installer in the Philadelphia and eastern PA region. Pre-sold jobs delivered to your dashboard.",
    zips: ["19101", "19103", "19106", "19123", "18901"],
    avgHomes: "1.5M+",
    marketNote:
      "Historic homes with basements and row houses with limited space make storage a must-have.",
  },
  "atlanta-ga": {
    label: "Atlanta",
    state: "Georgia",
    description:
      "Install tote storage systems across the Atlanta metro. Serve Fulton, DeKalb, Cobb, and Gwinnett counties.",
    zips: ["30301", "30305", "30309", "30318", "30324", "30328", "30338", "30344"],
    avgHomes: "1.2M+",
    marketNote:
      "Atlanta's sprawling suburbs and new construction create a steady stream of homeowners needing storage solutions.",
  },
  "charlotte-nc": {
    label: "Charlotte",
    state: "North Carolina",
    description:
      "Become an installer in the Charlotte metro. Serve Mecklenburg, Union, Cabarrus, and Gaston counties.",
    zips: ["28202", "28205", "28210", "28226", "28269", "28277", "28105", "28078"],
    avgHomes: "500K+",
    marketNote:
      "One of the fastest-growing metros in the US means new homeowners who need storage built from scratch.",
  },
  "raleigh-nc": {
    label: "Raleigh",
    state: "North Carolina",
    description:
      "Join the network in the Research Triangle. Serve Wake, Durham, and Orange counties.",
    zips: ["27601", "27604", "27607", "27610", "27615", "27703", "27560", "27513"],
    avgHomes: "450K+",
    marketNote:
      "Tech professionals moving to the Triangle want organized, modern homes — storage builds sell themselves.",
  },
  "nashville-tn": {
    label: "Nashville",
    state: "Tennessee",
    description:
      "Build tote rack systems across the Nashville metro. Serve Davidson, Williamson, and Rutherford counties.",
    zips: ["37201", "37203", "37206", "37209", "37215", "37027", "37064", "37067"],
    avgHomes: "450K+",
    marketNote:
      "Nashville's housing boom means garages full of boxes — homeowners are ready to organize.",
  },
  "dallas-tx": {
    label: "Dallas",
    state: "Texas",
    description:
      "Join the installer network in Dallas. Serve Dallas, Collin, Denton, and Tarrant counties.",
    zips: ["75201", "75204", "75214", "75225", "75243", "75024", "75034", "75070"],
    avgHomes: "1.5M+",
    marketNote:
      "Texas-sized garages need Texas-sized storage. DFW homeowners are actively seeking solutions.",
  },
  "fort-worth-tx": {
    label: "Fort Worth",
    state: "Texas",
    description:
      "Become an installer across Fort Worth and the western DFW metro. Serve Tarrant, Parker, and Johnson counties.",
    zips: ["76102", "76107", "76109", "76116", "76132", "76137", "76244", "76148"],
    avgHomes: "600K+",
    marketNote:
      "Fort Worth's suburban expansion means a steady pipeline of new homeowners needing garage storage.",
  },
  "houston-tx": {
    label: "Houston",
    state: "Texas",
    description:
      "Install tote racks across the greater Houston area. Serve Harris, Fort Bend, Montgomery, and Brazoria counties.",
    zips: ["77002", "77007", "77019", "77024", "77056", "77494", "77386", "77479"],
    avgHomes: "1.8M+",
    marketNote:
      "Houston's massive metro and year-round garage use make it one of the highest-demand markets in the country.",
  },
  "san-antonio-tx": {
    label: "San Antonio",
    state: "Texas",
    description:
      "Join the network in San Antonio. Serve Bexar, Comal, and Guadalupe counties.",
    zips: ["78201", "78205", "78209", "78216", "78229", "78240", "78247", "78258"],
    avgHomes: "550K+",
    marketNote:
      "Military families and growing suburbs create consistent demand for organized storage.",
  },
  "austin-tx": {
    label: "Austin",
    state: "Texas",
    description:
      "Become an installer in Austin. Serve Travis, Williamson, and Hays counties along the I-35 corridor.",
    zips: ["78701", "78704", "78731", "78745", "78759", "78681", "78664", "78660"],
    avgHomes: "500K+",
    marketNote:
      "Austin's tech-driven growth and new construction mean homeowners who want modern, organized spaces.",
  },
  "phoenix-az": {
    label: "Phoenix",
    state: "Arizona",
    description:
      "Install tote storage across the Phoenix metro and East Valley. Serve Maricopa County including Mesa, Chandler, Gilbert, and Tempe.",
    zips: ["85003", "85006", "85013", "85018", "85028", "85044", "85224", "85233"],
    avgHomes: "1.3M+",
    marketNote:
      "Phoenix garages double as year-round storage. Homeowners need organized systems to keep up.",
  },
  "scottsdale-az": {
    label: "Scottsdale",
    state: "Arizona",
    description:
      "Build premium tote storage systems in Scottsdale and Paradise Valley. Oversized garages, premium clients.",
    zips: ["85250", "85251", "85254", "85258", "85260", "85262", "85266", "85255"],
    avgHomes: "120K+",
    marketNote:
      "High-income homeowners with multi-car garages — premium storage builds at premium prices.",
  },
  "tampa-fl": {
    label: "Tampa",
    state: "Florida",
    description:
      "Join the network in Tampa Bay. Serve Hillsborough, Pinellas, and Pasco counties.",
    zips: ["33602", "33606", "33609", "33614", "33629", "33647", "33701", "33716"],
    avgHomes: "700K+",
    marketNote:
      "Tampa Bay's growth and Florida's year-round garage use keep demand consistent.",
  },
  "jacksonville-fl": {
    label: "Jacksonville",
    state: "Florida",
    description:
      "Become an installer on the First Coast. Serve Duval, St. Johns, Clay, and Nassau counties.",
    zips: ["32202", "32207", "32210", "32225", "32246", "32256", "32082", "32095"],
    avgHomes: "400K+",
    marketNote:
      "Military families and new suburban developments create consistent demand for storage installations.",
  },
  "indianapolis-in": {
    label: "Indianapolis",
    state: "Indiana",
    description:
      "Install tote racks in the Indianapolis metro. Serve Marion, Hamilton, Hendricks, and Johnson counties.",
    zips: ["46201", "46204", "46220", "46226", "46240", "46032", "46062", "46143"],
    avgHomes: "500K+",
    marketNote:
      "Affordable homes with spacious garages and basements — ideal for tote storage installations.",
  },
  "columbus-oh": {
    label: "Columbus",
    state: "Ohio",
    description:
      "Join the network in Columbus. Serve Franklin, Delaware, and Licking counties.",
    zips: ["43201", "43204", "43210", "43215", "43235", "43016", "43065", "43017"],
    avgHomes: "500K+",
    marketNote:
      "Ohio's largest metro with family-sized homes that need basement and garage storage solutions.",
  },
  "cincinnati-oh": {
    label: "Cincinnati",
    state: "Ohio",
    description:
      "Become an installer in the Cincinnati tri-state area. Serve Hamilton, Butler, Warren, and Clermont counties.",
    zips: ["45202", "45208", "45219", "45236", "45241", "45069", "45040", "45011"],
    avgHomes: "450K+",
    marketNote:
      "Tri-state metro with older homes that need upgraded storage — basements are a goldmine.",
  },
  "cleveland-oh": {
    label: "Cleveland",
    state: "Ohio",
    description:
      "Install tote storage for Greater Cleveland. Serve Cuyahoga, Lake, Lorain, and Summit counties.",
    zips: ["44101", "44106", "44111", "44114", "44124", "44133", "44060", "44017"],
    avgHomes: "500K+",
    marketNote:
      "Basement-heavy homes across Northeast Ohio create steady demand for organized storage.",
  },
  "minneapolis-mn": {
    label: "Minneapolis",
    state: "Minnesota",
    description:
      "Join the network in the Twin Cities. Serve Hennepin, Ramsey, Dakota, and Anoka counties.",
    zips: ["55401", "55404", "55408", "55416", "55426", "55104", "55113", "55337"],
    avgHomes: "750K+",
    marketNote:
      "Long winters mean garages and basements are essential storage — homeowners invest in organization.",
  },
  "st-louis-mo": {
    label: "St. Louis",
    state: "Missouri",
    description:
      "Become an installer in the greater St. Louis area. Serve St. Louis City, St. Louis County, St. Charles, and Jefferson counties.",
    zips: ["63101", "63104", "63108", "63118", "63139", "63017", "63301", "63021"],
    avgHomes: "600K+",
    marketNote:
      "Affordable metro with large basements — homeowners here are ready to organize.",
  },
  "kansas-city-mo": {
    label: "Kansas City",
    state: "Missouri",
    description:
      "Install tote racks across the KC metro. Serve Jackson, Clay, and Platte counties in MO and Johnson County in KS.",
    zips: ["64101", "64108", "64110", "64114", "64131", "66061", "66062", "66204"],
    avgHomes: "500K+",
    marketNote:
      "Family-friendly suburbs with spacious garages — the perfect market for tote storage.",
  },
  "milwaukee-wi": {
    label: "Milwaukee",
    state: "Wisconsin",
    description:
      "Join the network in the Milwaukee metro. Serve Milwaukee, Waukesha, Ozaukee, and Washington counties.",
    zips: ["53202", "53207", "53215", "53222", "53227", "53005", "53045", "53051"],
    avgHomes: "400K+",
    marketNote:
      "Wisconsin homes with basements and attached garages create year-round demand for storage builds.",
  },
  "detroit-mi": {
    label: "Detroit",
    state: "Michigan",
    description:
      "Become an installer in metro Detroit. Serve Wayne, Oakland, Macomb, and Washtenaw counties.",
    zips: ["48201", "48204", "48207", "48214", "48226", "48075", "48009", "48336"],
    avgHomes: "1M+",
    marketNote:
      "Large suburban homes with oversized garages and basements — Detroit is built for this service.",
  },
  "grand-rapids-mi": {
    label: "Grand Rapids",
    state: "Michigan",
    description:
      "Install tote racks across West Michigan. Serve Kent, Ottawa, and Muskegon counties.",
    zips: ["49503", "49506", "49512", "49525", "49534", "49418", "49301", "49315"],
    avgHomes: "250K+",
    marketNote:
      "West Michigan's family-oriented communities and affordable housing make storage a top priority.",
  },
  "louisville-ky": {
    label: "Louisville",
    state: "Kentucky",
    description:
      "Join the network in the Louisville metro. Serve Jefferson, Oldham, and Bullitt counties.",
    zips: ["40202", "40204", "40207", "40214", "40220", "40222", "40241", "40245"],
    avgHomes: "300K+",
    marketNote:
      "Louisville's mix of historic and new homes both need modern storage solutions.",
  },
  "memphis-tn": {
    label: "Memphis",
    state: "Tennessee",
    description:
      "Become an installer in the Memphis metro. Serve Shelby, Tipton, and Fayette counties.",
    zips: ["38103", "38111", "38117", "38120", "38125", "38134", "38138", "38018"],
    avgHomes: "350K+",
    marketNote:
      "Growing suburbs and affordable housing mean families are investing in garage organization.",
  },
  "richmond-va": {
    label: "Richmond",
    state: "Virginia",
    description:
      "Install tote racks in the greater Richmond area. Serve Richmond City, Henrico, Chesterfield, and Hanover counties.",
    zips: ["23219", "23220", "23225", "23229", "23233", "23060", "23112", "23059"],
    avgHomes: "350K+",
    marketNote:
      "Richmond's mix of historic homes and new developments creates diverse storage needs.",
  },
  "virginia-beach-va": {
    label: "Virginia Beach",
    state: "Virginia",
    description:
      "Join the network in Hampton Roads. Serve Virginia Beach, Norfolk, Chesapeake, and Newport News.",
    zips: ["23451", "23452", "23454", "23456", "23462", "23320", "23505", "23602"],
    avgHomes: "400K+",
    marketNote:
      "Military families constantly moving in need organized storage fast — pre-built systems sell on sight.",
  },
  "charleston-sc": {
    label: "Charleston",
    state: "South Carolina",
    description:
      "Become an installer in the Charleston Lowcountry. Serve Charleston, Berkeley, and Dorchester counties.",
    zips: ["29401", "29403", "29407", "29412", "29414", "29464", "29485", "29456"],
    avgHomes: "250K+",
    marketNote:
      "Charleston's explosive growth means new communities popping up monthly — all needing storage.",
  },
  "greenville-sc": {
    label: "Greenville",
    state: "South Carolina",
    description:
      "Install tote racks in the Greenville-Spartanburg Upstate region. Serve Greenville, Spartanburg, and Anderson counties.",
    zips: ["29601", "29605", "29607", "29609", "29615", "29650", "29681", "29301"],
    avgHomes: "300K+",
    marketNote:
      "Upstate SC's affordable homes with garages are the perfect fit for tote storage systems.",
  },
  "boise-id": {
    label: "Boise",
    state: "Idaho",
    description:
      "Join the network in the Treasure Valley. Serve Ada, Canyon, and Gem counties.",
    zips: ["83701", "83702", "83704", "83706", "83709", "83713", "83616", "83646"],
    avgHomes: "200K+",
    marketNote:
      "Boise's rapid growth from out-of-state transplants means new homeowners who want organized spaces.",
  },
  "portland-or": {
    label: "Portland",
    state: "Oregon",
    description:
      "Become an installer in the Portland metro. Serve Multnomah, Washington, and Clackamas counties.",
    zips: ["97201", "97205", "97209", "97214", "97232", "97005", "97034", "97068"],
    avgHomes: "500K+",
    marketNote:
      "Portland homeowners value practical, well-built solutions — tote racks sell themselves here.",
  },
  "seattle-wa": {
    label: "Seattle",
    state: "Washington",
    description:
      "Install tote storage across the Puget Sound region. Serve King, Snohomish, and Pierce counties.",
    zips: ["98101", "98103", "98107", "98115", "98199", "98004", "98052", "98033"],
    avgHomes: "800K+",
    marketNote:
      "High home values and limited space in Seattle make storage organization a premium service.",
  },
  "sacramento-ca": {
    label: "Sacramento",
    state: "California",
    description:
      "Join the network in Sacramento. Serve Sacramento, Placer, El Dorado, and Yolo counties.",
    zips: ["95811", "95814", "95816", "95822", "95833", "95661", "95630", "95762"],
    avgHomes: "600K+",
    marketNote:
      "Sacramento's suburban communities with attached garages are ideal for tote storage builds.",
  },
  "las-vegas-nv": {
    label: "Las Vegas",
    state: "Nevada",
    description:
      "Become an installer in the Las Vegas Valley. Serve Clark County including Henderson and North Las Vegas.",
    zips: ["89101", "89107", "89117", "89128", "89135", "89012", "89002", "89031"],
    avgHomes: "600K+",
    marketNote:
      "Vegas garages take a beating from the heat — homeowners want clean, organized storage they can access easily.",
  },
  "tucson-az": {
    label: "Tucson",
    state: "Arizona",
    description:
      "Install tote racks in the Tucson metro. Serve Pima County including Marana, Oro Valley, and Sahuarita.",
    zips: ["85701", "85710", "85711", "85718", "85741", "85742", "85748", "85737"],
    avgHomes: "300K+",
    marketNote:
      "Retirees and families in Tucson both need organized storage — and they don't want to build it themselves.",
  },
  "albuquerque-nm": {
    label: "Albuquerque",
    state: "New Mexico",
    description:
      "Join the network in Albuquerque. Serve Bernalillo and Sandoval counties.",
    zips: ["87101", "87106", "87110", "87114", "87120", "87122", "87123", "87144"],
    avgHomes: "250K+",
    marketNote:
      "Low competition and a growing metro mean you can own this market as an early installer.",
  },
  "oklahoma-city-ok": {
    label: "Oklahoma City",
    state: "Oklahoma",
    description:
      "Become an installer in the OKC metro. Serve Oklahoma, Cleveland, and Canadian counties.",
    zips: ["73101", "73102", "73107", "73112", "73120", "73013", "73034", "73003"],
    avgHomes: "400K+",
    marketNote:
      "Affordable homes with large garages — Oklahoma homeowners are ready for organized storage.",
  },
  "tulsa-ok": {
    label: "Tulsa",
    state: "Oklahoma",
    description:
      "Install tote racks in the Tulsa area. Serve Tulsa, Creek, Rogers, and Wagoner counties.",
    zips: ["74101", "74104", "74105", "74114", "74136", "74012", "74055", "74008"],
    avgHomes: "300K+",
    marketNote:
      "Tulsa's affordable housing market means families can invest in home improvements like storage.",
  },
  "des-moines-ia": {
    label: "Des Moines",
    state: "Iowa",
    description:
      "Join the network in Des Moines. Serve Polk, Dallas, and Warren counties.",
    zips: ["50309", "50310", "50315", "50317", "50312", "50023", "50131", "50263"],
    avgHomes: "200K+",
    marketNote:
      "Midwest basements and garages are storage gold — homeowners just need someone to build the system.",
  },
  "knoxville-tn": {
    label: "Knoxville",
    state: "Tennessee",
    description:
      "Become an installer in the Knoxville area. Serve Knox, Blount, Anderson, and Loudon counties.",
    zips: ["37902", "37909", "37914", "37919", "37922", "37934", "37801", "37830"],
    avgHomes: "250K+",
    marketNote:
      "East Tennessee's growing suburbs and affordable homes make it a great market for storage builds.",
  },
  "huntsville-al": {
    label: "Huntsville",
    state: "Alabama",
    description:
      "Install tote storage in the Huntsville-Decatur metro. Serve Madison, Limestone, and Morgan counties.",
    zips: ["35801", "35802", "35805", "35806", "35811", "35758", "35749", "35756"],
    avgHomes: "200K+",
    marketNote:
      "Huntsville is one of the fastest-growing cities in the South — new homes mean new storage needs.",
  },
  "birmingham-al": {
    label: "Birmingham",
    state: "Alabama",
    description:
      "Join the network in the Birmingham metro. Serve Jefferson, Shelby, and St. Clair counties.",
    zips: ["35203", "35205", "35209", "35213", "35216", "35244", "35242", "35007"],
    avgHomes: "350K+",
    marketNote:
      "Birmingham's suburban growth and affordable cost of living make storage builds a natural fit.",
  },
  "san-diego-ca": {
    label: "San Diego",
    state: "California",
    description:
      "Become an installer in San Diego County. Serve coastal and inland communities from La Jolla to El Cajon.",
    zips: ["92101", "92103", "92107", "92117", "92126", "92131", "92071", "92020"],
    avgHomes: "500K+",
    marketNote:
      "Premium market with homeowners willing to invest in quality garage organization.",
  },
  "colorado-springs-co": {
    label: "Colorado Springs",
    state: "Colorado",
    description:
      "Install tote racks along the southern Front Range. Serve El Paso and Teller counties.",
    zips: ["80901", "80903", "80907", "80917", "80920", "80922", "80925", "80132"],
    avgHomes: "300K+",
    marketNote:
      "Military families and outdoor enthusiasts need organized garage storage — you'll stay busy.",
  },
  "spokane-wa": {
    label: "Spokane",
    state: "Washington",
    description:
      "Join the network in the Inland Northwest. Serve Spokane and Kootenai counties.",
    zips: ["99201", "99203", "99205", "99208", "99223", "99004", "99016", "99019"],
    avgHomes: "200K+",
    marketNote:
      "Spokane's affordable housing and cold winters mean garages and basements need serious storage.",
  },
  "provo-ut": {
    label: "Provo",
    state: "Utah",
    description:
      "Become an installer in Utah County. Serve Provo, Orem, Lehi, and Spanish Fork.",
    zips: ["84601", "84604", "84606", "84043", "84057", "84660", "84097", "84003"],
    avgHomes: "200K+",
    marketNote:
      "Large family households in Utah County need serious storage — and they buy fast.",
  },
  "bakersfield-ca": {
    label: "Bakersfield",
    state: "California",
    description:
      "Install tote storage for Bakersfield-area homes. Serve Kern County.",
    zips: ["93301", "93304", "93306", "93309", "93312", "93313", "93311", "93314"],
    avgHomes: "200K+",
    marketNote:
      "Affordable California market with spacious garages — low competition, high potential.",
  },
  "reno-nv": {
    label: "Reno",
    state: "Nevada",
    description:
      "Join the network in the Reno-Sparks metro. Serve Washoe County and the Truckee Meadows.",
    zips: ["89501", "89502", "89503", "89509", "89511", "89431", "89434", "89436"],
    avgHomes: "150K+",
    marketNote:
      "Reno's tech-fueled growth and transplants from the Bay Area want organized, modern homes.",
  },
  "wichita-ks": {
    label: "Wichita",
    state: "Kansas",
    description:
      "Become an installer in the Wichita area. Serve Sedgwick, Butler, and Harvey counties.",
    zips: ["67201", "67203", "67207", "67212", "67226", "67230", "67235", "67052"],
    avgHomes: "200K+",
    marketNote:
      "Low cost of living and large garages mean homeowners can afford — and want — organized storage.",
  },
  "little-rock-ar": {
    label: "Little Rock",
    state: "Arkansas",
    description:
      "Install tote racks in the Little Rock metro. Serve Pulaski, Saline, and Faulkner counties.",
    zips: ["72201", "72204", "72205", "72207", "72211", "72223", "72002", "72022"],
    avgHomes: "200K+",
    marketNote:
      "Central Arkansas's affordable homes with garages are wide open for tote storage installations.",
  },
};

interface PageProps {
  params: Promise<{ region: string }>;
}

export async function generateStaticParams() {
  return Object.keys(REGIONS).map((region) => ({ region }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { region: regionSlug } = await params;
  const region = REGIONS[regionSlug];
  if (!region) {
    return { title: "Installer Opportunity Not Found | Storage Network" };
  }

  return {
    title: `Become a Tote Rack Installer in ${region.label}, ${region.state} | Storage Network`,
    description: `Join the Storage Network in ${region.label}. Get pre-sold jobs, auto-generated cut lists, and instant payouts. Free until the platform proves its value in 3 completed jobs. No franchise fee, no inventory.`,
    openGraph: {
      title: `Become a Tote Rack Installer in ${region.label}, ${region.state}`,
      description: `Get pre-sold installation jobs in ${region.label}. Zero upfront cost. Free until the platform proves its value in 3 completed jobs.`,
    },
  };
}

export default async function InstallerJoinRegionPage({ params }: PageProps) {
  const { region: regionSlug } = await params;
  const region = REGIONS[regionSlug];

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
    "@type": "JobPosting",
    title: `Tote Rack Installer in ${region.label}, ${region.state}`,
    description: region.description,
    url: `https://storage-network.app/become-installer/${regionSlug}`,
    hiringOrganization: {
      "@type": "Organization",
      name: "Storage Network",
      sameAs: "https://storage-network.app",
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: region.label,
        addressRegion: region.state,
        addressCountry: "US",
      },
    },
    employmentType: "CONTRACTOR",
    baseSalary: {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: { "@type": "QuantitativeValue", minValue: 800, unitText: "PER_JOB" },
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localSchema) }}
      />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/Header_avatar_logo.png"
              alt="Storage Network"
              width={32}
              height={32}
              className="h-8 w-auto object-contain"
            />
            <span className="text-lg font-bold text-white">
              Storage Network
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/demo"
              className="hidden rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-400 transition-colors hover:border-yellow-400/50 hover:bg-yellow-400/20 sm:inline-flex"
            >
              Book a Demo
            </Link>
            <Link
              href="/join"
              className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
            >
              Join Now
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-800 px-4 pb-16 pt-12">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.08) 0%, transparent 60%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-400">
            Now Accepting Installers in {region.state}
          </p>

          <h1 className="mb-4 text-3xl font-black uppercase leading-tight text-white sm:text-4xl md:text-5xl">
            Become a Tote Rack Installer in{" "}
            <span className="text-yellow-400">{region.label}</span>
          </h1>

          <p className="mx-auto mb-6 max-w-xl text-base text-stone-400 sm:text-lg">
            {region.description} Get pre-sold jobs with cut lists, material
            plans, and deposits already collected — you just build.
          </p>

          {/* Free trial callout */}
          <div className="mx-auto mb-8 max-w-md rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-5 py-3">
            <p className="text-sm font-bold text-emerald-400">
              Free until the platform proves its value
            </p>
            <p className="mt-1 text-xs text-stone-400">
              You pay nothing until 3 completed jobs land in your dashboard.
              If we can&apos;t deliver real work, you owe us nothing.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/join"
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-8 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
            >
              Start Your Free Trial
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-8 py-4 text-sm font-bold text-stone-300 transition-all hover:border-yellow-400/30 hover:text-white"
            >
              Book a Free Demo Call
            </Link>
          </div>
        </div>
      </section>

      {/* ── Earnings Snapshot ─────────────────────────────────────── */}
      <section className="border-b border-slate-800 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-400">
            Earnings in {region.label}
          </p>
          <h2 className="mb-8 text-center text-2xl font-black uppercase text-white sm:text-3xl">
            What Installers Are Making
          </h2>

          <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-black text-yellow-400 sm:text-3xl">
                  $800+
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Per Job Avg
                </p>
              </div>
              <div>
                <p className="text-2xl font-black text-white sm:text-3xl">
                  2–3 hrs
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Avg Install Time
                </p>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-400 sm:text-3xl">
                  $0
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Startup Cost
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-slate-800/50 p-4">
              <p className="text-center text-xs leading-relaxed text-stone-400">
                {region.label} installers average{" "}
                <strong className="text-white">3–5 jobs per week</strong> using
                materials from their local Home Depot. No inventory, no
                warehouse, no van wraps. Just you, your tools, and pre-sold
                work.
              </p>
            </div>
          </div>

          {/* Market note */}
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-yellow-400">
              {region.label} Market — {region.avgHomes} Homes
            </p>
            <p className="text-sm text-stone-400">{region.marketNote}</p>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────── */}
      <section className="border-b border-slate-800 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-400">
            How It Works
          </p>
          <h2 className="mb-4 text-center text-2xl font-black uppercase text-white sm:text-3xl">
            You Build. We Handle{" "}
            <span className="text-yellow-400">Everything Else.</span>
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-sm text-stone-400">
            From the first customer click to the money hitting your bank
            account, here&apos;s what the platform does for you.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "We Sell the Job",
                desc: "Customers design their storage system in our 3D configurator and pay a deposit. The job is pre-sold before you ever hear about it.",
              },
              {
                step: "2",
                title: "You Get the Plan",
                desc: "Material list, cut plan, plywood rail counts, screw counts — everything calculated down to the inch. Just grab your lumber and go.",
              },
              {
                step: "3",
                title: "Build. Get Paid. Repeat.",
                desc: 'Tap "Complete" when you\'re done. Funds hit your bank account via Stripe instantly. No invoicing, no chasing checks.',
              },
            ].map((block) => (
              <div
                key={block.step}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 text-sm font-black text-yellow-400 ring-1 ring-yellow-400/20">
                  {block.step}
                </div>
                <h3 className="mb-2 text-lg font-bold text-white">
                  {block.title}
                </h3>
                <p className="text-sm leading-relaxed text-stone-400">
                  {block.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform Features ────────────────────────────────────── */}
      <section className="border-b border-slate-800 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-400">
            Everything Included
          </p>
          <h2 className="mb-4 text-center text-2xl font-black uppercase text-white sm:text-3xl">
            One Platform. Every Tool You Need.
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-sm text-stone-400">
            $49/mo after your free trial — includes every feature below.
            3% maintenance fee on your direct leads. 15% on network leads.
            No hidden costs.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Pre-Sold Leads",
                desc: "Customers design, configure, and pay a deposit before you pick up a tool. No selling, no bidding, no chasing.",
              },
              {
                title: "Auto Cut Lists",
                desc: "Every job comes with exact cut lists, material quantities, and build instructions. No math, no guesswork.",
              },
              {
                title: "Instant Payouts",
                desc: "Deposits hit your Stripe account instantly. Collect the balance on-site via cash, Venmo, or card.",
              },
              {
                title: "3D Configurator",
                desc: "Customers see their exact storage system in 3D before ordering. No miscommunication, no change orders.",
              },
              {
                title: "AI Marketing Scripts",
                desc: "Generate ready-to-post scripts for Facebook, Instagram, TikTok, Nextdoor, and email in seconds.",
              },
              {
                title: "Custom Pricing",
                desc: "Set your own labor rate and material markup. The platform calculates everything. You keep every dollar.",
              },
              {
                title: "Branded Booking Page",
                desc: "Your own branded page with portfolio, reviews, and direct booking. Share the link anywhere.",
              },
              {
                title: "Job Scheduling",
                desc: "Set your availability, manage your calendar, and let customers book times that work for you.",
              },
              {
                title: "Referral Program",
                desc: "Share your link anywhere. Earn 30% of the deposit when someone books through it — even in another state.",
              },
              {
                title: "Analytics Dashboard",
                desc: "Track leads, conversions, earnings, and growth. See what's working and double down.",
              },
              {
                title: "Installer Community",
                desc: "Connect with installers nationwide. Share tips, ask questions, and grow together.",
              },
              {
                title: "Training Library",
                desc: "Step-by-step guides and training videos so you can deliver a perfect install every time.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition-colors hover:border-slate-700"
              >
                <h3 className="mb-1.5 text-sm font-bold uppercase tracking-wider text-white">
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed text-stone-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Zero Risk ────────────────────────────────────────────── */}
      <section className="border-b border-slate-800 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400">
            Zero Risk
          </p>
          <h2 className="mb-4 text-center text-2xl font-black uppercase text-white sm:text-3xl">
            Free For You Until We Prove It Works
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-center text-sm text-stone-400">
            We&apos;re so confident the platform delivers real value that we
            don&apos;t charge you a dime until it proves itself.
          </p>

          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-400/5 to-slate-950 p-8">
            <div className="space-y-6">
              {[
                {
                  title: "No credit card required to start",
                  desc: "Sign up in 60 seconds. No payment info. No commitment. Just create your account and explore the platform.",
                },
                {
                  title: "Free until 3 completed jobs",
                  desc: "Your trial doesn't end after 7 or 14 days like other platforms. It ends when the platform demonstrates its true value — after 3 paid jobs land in your dashboard. If we can't deliver work, you owe nothing.",
                },
                {
                  title: "No franchise fee. No inventory. No equipment.",
                  desc: "All you need are basic power tools you already own — a circular saw, drill, and tape measure. Buy materials per-job from your local Home Depot. Zero overhead.",
                },
                {
                  title: "Cancel anytime, keep everything",
                  desc: "After your trial, it's $49/month. Cancel anytime with one click. You keep your portfolio, your reviews, and your booking page.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/20">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-stone-400">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Objection Handling / FAQ ──────────────────────────────── */}
      <section className="border-b border-slate-800 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-400">
            Common Questions
          </p>
          <h2 className="mb-8 text-center text-2xl font-black uppercase text-white sm:text-3xl">
            Still Thinking About It?
          </h2>

          <div className="space-y-4">
            {[
              {
                q: "Do I need a contractor's license?",
                a: "No. Tote rack installation is considered basic carpentry in most areas — like building a bookshelf. No license, no permit, no inspection required. Just solid woodworking skills.",
              },
              {
                q: "What tools do I need?",
                a: "A circular saw (or miter saw), drill/driver, tape measure, speed square, and clamps. That's it. Most installers already own everything they need.",
              },
              {
                q: "How do I get jobs?",
                a: "Two ways: (1) The network sends you pre-sold jobs from customers in your area — you just accept or decline. (2) You use your branded booking page, AI marketing scripts, and referral link to generate your own leads.",
              },
              {
                q: "What does it cost?",
                a: "Nothing upfront. Your trial is free until the platform proves its value with 3 completed jobs. After that, it's $49/month with a 3% fee on your direct leads and 15% on network leads. No hidden fees.",
              },
              {
                q: "How much can I realistically earn?",
                a: `Installers in ${region.label} average $800+ per job, with each install taking 2–3 hours. At 3–5 jobs per week, that's $2,400–$4,000+ weekly. Your earnings depend on your hustle and availability.`,
              },
              {
                q: "Can I keep my current job?",
                a: "Absolutely. Many installers start part-time — weekends and evenings. You set your own availability and accept only the jobs that fit your schedule.",
              },
            ].map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <p className="mb-2 text-sm font-bold text-white">{item.q}</p>
                <p className="text-sm leading-relaxed text-stone-400">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Service Area ─────────────────────────────────────────── */}
      <section className="border-b border-slate-800 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-2xl font-bold text-white">
            Service Area — {region.label}, {region.state}
          </h2>
          <p className="mb-4 text-sm text-stone-400">
            As an installer in {region.label}, you&apos;ll serve homeowners
            across the metro area. Sample ZIP codes in your coverage zone:
          </p>
          <div className="flex flex-wrap gap-2">
            {region.zips.map((z) => (
              <span
                key={z}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 font-mono text-sm text-stone-400"
              >
                {z}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-3 text-3xl font-black uppercase text-white sm:text-4xl">
            Ready to Start Earning in{" "}
            <span className="text-yellow-400">{region.label}</span>?
          </h2>
          <p className="mb-4 text-base text-stone-400">
            Create your account in 60 seconds. No credit card. No commitment.
          </p>
          <p className="mb-8 text-sm font-semibold text-emerald-400">
            Free until the platform proves its value — after 3 completed jobs.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/join"
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-10 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
            >
              Join the Network — It&apos;s Free
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-8 py-4 text-sm font-bold text-stone-300 transition-all hover:border-yellow-400/30 hover:text-white"
            >
              Book a Free Demo Call
            </Link>
          </div>

          <p className="mt-6 text-xs text-stone-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-yellow-400 hover:text-yellow-300"
            >
              Sign In
            </Link>
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 bg-slate-950 px-4 py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/Header_avatar_logo.png"
              alt="Storage Network"
              width={32}
              height={32}
              className="h-8 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-6 text-[10px] text-stone-600">
            <Link href="/features" className="hover:text-yellow-400 transition-colors">
              Features
            </Link>
            <Link href="/demo" className="hover:text-yellow-400 transition-colors">
              Book Demo
            </Link>
            <Link href="/join" className="hover:text-yellow-400 transition-colors">
              Join
            </Link>
            <Link href="/login" className="hover:text-yellow-400 transition-colors">
              Login
            </Link>
          </div>
          <p className="text-[10px] text-stone-700">
            &copy; {new Date().getFullYear()} Storage-Network.app
          </p>
        </div>
      </footer>
    </div>
  );
}
