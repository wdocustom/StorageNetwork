// ═══════════════════════════════════════════════════════════════════════════
// Platform Registry — Single Source of Truth for AI Chatbots
//
// Instead of hardcoding platform knowledge into prompts, chatbots
// query this registry at runtime. When we add a feature, we add it
// here once — both installer and customer chatbots pick it up.
//
// This is a server-only module (only imported by API routes).
// ═══════════════════════════════════════════════════════════════════════════

export interface PlatformPage {
  path: string;
  name: string;
  audience: "customer" | "installer" | "both";
  description: string;
}

export interface PlatformFeature {
  id: string;
  name: string;
  audience: "customer" | "installer" | "both";
  description: string;
  details: string;
}

export interface PlatformFaq {
  question: string;
  answer: string;
  audience: "customer" | "installer" | "both";
}

// ── Pages ────────────────────────────────────────────────────────────────

export const PAGES: PlatformPage[] = [
  // Customer-facing
  { path: "/", name: "Landing Page", audience: "customer", description: "Main landing page with ZIP code search to find local installer, guided storage configurator." },
  { path: "/design", name: "3D Design Configurator", audience: "customer", description: "Full 3D storage configurator where customers design their tote rack, choose add-ons, and book installation with their local installer." },
  { path: "/demo", name: "Book a Demo Call", audience: "both", description: "Free 15-minute live demo call. A real person walks potential installers or curious customers through the entire platform — the 3D configurator, dashboard, marketing tools, everything." },

  // Installer-facing (public)
  { path: "/join", name: "Installer Signup", audience: "installer", description: "Main signup page for new installers. Create account, claim territory, start free trial." },
  { path: "/invite", name: "Installer Invite", audience: "installer", description: "Referral-based signup page. Same as /join but tracks which installer referred them." },
  { path: "/partner/join", name: "Partner Signup", audience: "installer", description: "Partner/affiliate signup for installers referred by marketing partners." },
  { path: "/features", name: "Platform Features", audience: "installer", description: "Full feature breakdown showing everything included in the platform — configurator, cut plans, inventory, reviews, AI assistant, marketing tools, and more." },
  { path: "/p/[slug]", name: "Installer Portfolio", audience: "both", description: "Public profile page for each installer at storage-network.app/p/your-name. Shows photos, verified reviews, service area, and lets customers book directly." },
  { path: "/login", name: "Installer Login", audience: "installer", description: "Login page for existing installers to access their dashboard." },

  // Installer dashboard
  { path: "/dashboard", name: "Installer Dashboard", audience: "installer", description: "Main dashboard — see leads, active jobs, analytics, and revenue at a glance." },
  { path: "/dashboard/build", name: "Build Configurator", audience: "installer", description: "Create quotes for customers. Bestseller presets, custom quotes, AI Builder (describe what to build in plain English), open shelving, overhead storage. Generate shareable link or email quote." },
  { path: "/dashboard/leads", name: "Lead Management", audience: "installer", description: "View and manage all incoming leads — accept jobs, track status, request customer reviews after completion." },
  { path: "/dashboard/profile", name: "Profile & Pricing Settings", audience: "installer", description: "Configure business name, avatar, portfolio photos, bio, service area, and ALL pricing — per-slot rates, per-tote costs, add-on prices, preset pricing overrides, feature toggles (mini totes, shelving, overhead, planters)." },
  { path: "/dashboard/schedule", name: "Schedule & Availability", audience: "installer", description: "Set working days, blackout dates, and toggle customer-facing scheduling on/off. When scheduling is off, customers skip the calendar step." },
  { path: "/dashboard/marketing", name: "Marketing Tools", audience: "installer", description: "AI script generator for social media posts, booking link to share, QR code for portfolio page, Facebook group finder for local posting." },
  { path: "/dashboard/inventory", name: "Smart Inventory", audience: "installer", description: "Track lumber inventory across jobs. AI-powered material scanning from receipts. See what you have in stock vs what you need for upcoming jobs." },
];

// ── Features ─────────────────────────────────────────────────────────────

export const FEATURES: PlatformFeature[] = [
  {
    id: "3d-configurator",
    name: "3D Customer Configurator",
    audience: "both",
    description: "Customers design their storage system in a 3D tool and see instant pricing.",
    details: "Full 3D preview with accurate dimensions. Customers choose columns, rows, tote type (HDX/Greenmade), tote color (black/clear), wheels, plywood top, and more. Shows exact pricing using installer's custom rates. Supports bestseller presets (Indiana Joe, Cornhusker, Long Ranger, Gas Station, Track Norris) and custom sizes.",
  },
  {
    id: "ai-design-assistant",
    name: "AI Design Assistant",
    audience: "both",
    description: "AI chatbot on every design page that guides customers through building their storage system.",
    details: "Uses the installer's name, exact pricing, and product catalog. Only offers products the installer has enabled. Gives accurate quotes by calling the real pricing calculator (not estimates). Available 24/7. Supports multi-unit builds. Customers can get walked through wall measurements, tote options, wheels, top — step by step.",
  },
  {
    id: "ai-builder",
    name: "AI Builder (Installer Tool)",
    audience: "installer",
    description: "Natural language build tool on the /dashboard/build page.",
    details: "Installers describe what they want to build in plain English (e.g. 'Indiana Joe no totes and a 4x4 with wheels') and the AI parses it into structured configs with accurate pricing. Supports presets, custom sizes, wall dimensions, and multi-unit builds. Pricing uses the installer's actual rates.",
  },
  {
    id: "portfolio-page",
    name: "Branded Portfolio Page",
    audience: "installer",
    description: "Every installer gets a public profile page at storage-network.app/p/your-name.",
    details: "Shows business name, avatar, portfolio photos, bio, service area, verified customer reviews with star ratings, and a direct booking link. Customers can view the installer's work and book directly. Comes with a downloadable QR code for business cards and flyers.",
  },
  {
    id: "cut-plans",
    name: "Auto-Generated Cut Plans & Material Lists",
    audience: "installer",
    description: "Every job comes with precise, board-by-board cut plans and bin-packed material lists.",
    details: "Automatically generated for every build configuration. Shows exact lumber cuts with woodworking fractions (to 1/8\"), shopping lists for the lumber yard, and material cost estimates. Supports custom material pricing so installers can track their margins.",
  },
  {
    id: "stripe-payouts",
    name: "Stripe Instant Payouts",
    audience: "installer",
    description: "Platform handles all payment processing. Customer pays, money hits your bank via Stripe.",
    details: "No invoicing, no chasing checks. Customers pay a deposit through the platform. Installer gets paid via Stripe — can set up instant payouts to their bank account. The platform handles all payment processing, refunds, and disputes.",
  },
  {
    id: "verified-reviews",
    name: "Verified Customer Reviews",
    audience: "both",
    description: "Customers leave verified reviews tied to actual paid jobs.",
    details: "After a job is completed, installers can request reviews via email or shareable link. Customers rate with stars, pick tags (Professional, On Time, Quality Build), and write comments. Every review gets a 'Verified Purchase' badge. Reviews display on the installer's portfolio page with star distribution and average rating.",
  },
  {
    id: "smart-inventory",
    name: "Smart Inventory Manager",
    audience: "installer",
    description: "Track your lumber inventory across jobs from the installer dashboard.",
    details: "Located at /dashboard/inventory. Tracks lumber stock across all your jobs. AI-powered material scanning from receipts — snap a photo of your lumber yard receipt and the system reads it automatically. Shows what you have in stock vs what you need for upcoming builds. Helps you avoid over-buying and know exactly what to grab at the store.",
  },
  {
    id: "customer-inventory",
    name: "Customer Tote Inventory",
    audience: "both",
    description: "Every rack gets a free digital inventory system.",
    details: "Customers scan a QR code on their rack to catalog what's in each tote using AI-powered photo scanning. Creates a searchable digital inventory of their storage. Great value-add that makes builds sticky and drives referrals.",
  },
  {
    id: "marketing-tools",
    name: "AI Marketing Scripts & Tools",
    audience: "installer",
    description: "AI-powered script generator for social media posts, plus booking link and QR code.",
    details: "Generates ready-to-paste posts for Facebook, Instagram, Nextdoor, Craigslist — localized to the installer's city. Different tones and hooks every time. Includes a 'Where to Post' finder that identifies relevant local Facebook groups. Comes with a shareable booking link and downloadable QR code for the portfolio page.",
  },
  {
    id: "scheduling",
    name: "Booking & Scheduling System",
    audience: "both",
    description: "Customers pick a date, installer confirms. No phone tag.",
    details: "Calendar-based scheduling respects installer's working days and blackout dates. Shows earliest available date based on lead time. Installer can toggle scheduling on/off — when off, customers skip the calendar and the installer coordinates dates directly via email after booking.",
  },
  {
    id: "territory",
    name: "Exclusive Territory System",
    audience: "installer",
    description: "Each installer owns an exclusive cluster of ZIP codes. No competing with 50 other contractors.",
    details: "Density-aware cluster assignment: urban areas get tighter clusters (~15 ZIPs), suburban gets ~40, rural gets ~60. No two installers share the same ZIP code. Enforced by database constraint. Installer sets their own pricing and controls their own service area.",
  },
  {
    id: "multiple-products",
    name: "Multiple Product Lines",
    audience: "both",
    description: "Not just tote racks — overhead ceiling storage, open shelving, raised bed planters.",
    details: "Installers can enable/disable product lines from their profile settings. Each has its own 3D configurator, pricing controls, and material lists. Overhead ceiling storage (2x2 to 4x4 grids), open shelving (4-6ft, short/tall), and raised bed planters (8 sizes, 4 finishes, pest covers). One platform, multiple revenue streams.",
  },
  {
    id: "referral-bounty",
    name: "Referral Bounty Program",
    audience: "installer",
    description: "Refer another installer, earn a bounty when they complete their first job.",
    details: "Share your referral link. When a new installer signs up through it and completes their first paid job, you earn a bounty. Passive income from growing the network. Also handles out-of-area leads — if a customer uses your link but enters a ZIP outside your territory, the lead routes to the local installer and you get a referral credit.",
  },
  {
    id: "custom-services",
    name: "Custom Service Listings",
    audience: "installer",
    description: "Create your own service listings beyond the built-in product lines.",
    details: "Garage clean-outs, custom builds, assembly services — whatever you offer. Add custom service cards to your portfolio page with your own descriptions, photos, and pricing. Customers can book these alongside storage system installations.",
  },
  {
    id: "demo-call",
    name: "Free Demo Call",
    audience: "both",
    description: "Book a free 15-minute live demo at storage-network.app/demo.",
    details: "A real person walks you through the entire platform live — the 3D configurator, installer dashboard, marketing tools, pricing settings, everything. No commitment, no sales pitch. Available for both potential installers and curious customers who want to see it before signing up.",
  },
];

// ── Trial & Pricing ──────────────────────────────────────────────────────

export const TRIAL_INFO = {
  description: "Free to start — no credit card, no commitment",
  trialLength: "3 paid jobs OR 45 days, whichever comes first",
  fullAccess: true,
  monthlyPrice: 49,
  directLeadFee: "3%",
  networkLeadFee: "15%",
  networkLeadExplanation: "The 15% on platform leads is a finder's fee for customers you never would have had. For your own customers (direct leads), only 3% — less than credit card processing at most places.",
};

// ── FAQ ──────────────────────────────────────────────────────────────────

export const FAQ: PlatformFaq[] = [
  { question: "How much does it cost?", answer: `Free trial — no credit card. ${TRIAL_INFO.trialLength}. After trial: $${TRIAL_INFO.monthlyPrice}/month. Platform takes ${TRIAL_INFO.directLeadFee} on your own leads, ${TRIAL_INFO.networkLeadFee} on leads the platform brings you.`, audience: "installer" },
  { question: "Can I see a demo first?", answer: "Yes! Book a free 15-minute demo call at storage-network.app/demo. A real person walks you through everything live.", audience: "both" },
  { question: "Can I set my own prices?", answer: "100%. You control per-slot pricing, per-tote costs, add-on prices (wheels, plywood top), and even preset pricing overrides. The platform provides defaults but you override them to match your market.", audience: "installer" },
  { question: "What if I don't get any jobs?", answer: "Then you've spent zero dollars. The trial is free. But the installers who succeed put up photos of their work and share their portfolio link.", audience: "installer" },
  { question: "Are there other installers in my area?", answer: "Each ZIP code is exclusively owned by one installer. No competing for the same customer. More installers in a region means more marketing investment, which brings more total customers.", audience: "installer" },
  { question: "What products can I build?", answer: "Tote storage racks (27-gallon and optional 6.5qt mini), open shelving, overhead ceiling storage, and raised bed planters. Each has its own 3D configurator and material lists. You enable/disable what you offer from your profile.", audience: "installer" },
  { question: "How do customers find me?", answer: "Customers enter their ZIP code on the landing page. The platform matches them with you based on your territory. They can also reach you directly via your portfolio link (storage-network.app/p/your-name) or QR code.", audience: "installer" },
  { question: "How do payments work?", answer: "Customers pay a deposit through the platform via Stripe. You get paid directly to your bank account. No invoicing, no check-chasing. The platform handles all payment processing.", audience: "installer" },
  { question: "What's the AI Design Assistant?", answer: "An AI chatbot on every design page that guides customers through building their storage system. Uses your name, your exact pricing, and only the products you offer. Gives accurate quotes 24/7. Helps convert customers who feel overwhelmed by the 3D configurator.", audience: "both" },
  { question: "Do I need to be tech-savvy?", answer: "No. If you can text and take photos, you can use this. The heavy lifting is on the customer side — they use the 3D designer. You get a notification, look at the build, accept the job, and build it. Cut plans are a PDF. The booking page is just a link you share.", audience: "installer" },
];

// ── Lookup Function (called by chatbot tools) ────────────────────────────

export function lookupPlatformInfo(query: string, audience: "customer" | "installer"): string {
  const q = query.toLowerCase();
  const results: string[] = [];

  // Search FAQ first (most specific)
  for (const faq of FAQ) {
    if (faq.audience !== audience && faq.audience !== "both") continue;
    if (q.includes(faq.question.toLowerCase().slice(0, 20)) || faq.question.toLowerCase().includes(q.slice(0, 30))) {
      results.push(`Q: ${faq.question}\nA: ${faq.answer}`);
    }
  }

  // Search features
  for (const f of FEATURES) {
    if (f.audience !== audience && f.audience !== "both") continue;
    const nameMatch = q.includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(q);
    const descMatch = f.description.toLowerCase().includes(q) || f.details.toLowerCase().includes(q);
    // Keyword matching
    const keywords = q.split(/\s+/).filter((w) => w.length > 3);
    const keywordMatch = keywords.some((kw) =>
      f.name.toLowerCase().includes(kw) || f.description.toLowerCase().includes(kw) || f.details.toLowerCase().includes(kw)
    );
    if (nameMatch || descMatch || keywordMatch) {
      results.push(`Feature: ${f.name}\n${f.description}\nDetails: ${f.details}`);
    }
  }

  // Search pages
  for (const p of PAGES) {
    if (p.audience !== audience && p.audience !== "both") continue;
    const keywords = q.split(/\s+/).filter((w) => w.length > 3);
    const match = keywords.some((kw) =>
      p.name.toLowerCase().includes(kw) || p.description.toLowerCase().includes(kw)
    );
    if (match) {
      results.push(`Page: ${p.name} (${p.path})\n${p.description}`);
    }
  }

  // Trial/pricing info
  if (q.includes("cost") || q.includes("price") || q.includes("trial") || q.includes("free") || q.includes("pay") || q.includes("fee") || q.includes("subscription")) {
    results.push(`Trial: ${TRIAL_INFO.description}. ${TRIAL_INFO.trialLength}. Full access during trial. After trial: $${TRIAL_INFO.monthlyPrice}/month. Direct lead fee: ${TRIAL_INFO.directLeadFee}. Network lead fee: ${TRIAL_INFO.networkLeadFee}. ${TRIAL_INFO.networkLeadExplanation}`);
  }

  if (results.length === 0) {
    return "No specific information found for this query. Answer based on your general knowledge of the platform, or suggest the user book a demo at storage-network.app/demo for detailed answers.";
  }

  return results.slice(0, 5).join("\n\n---\n\n");
}
