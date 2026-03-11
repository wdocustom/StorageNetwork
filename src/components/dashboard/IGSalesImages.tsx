"use client";

import { useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Image as ImageIcon,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// IGSalesImages — Admin-only IG post template gallery
//
// Renders 7+ branded 1080×1080 IG post designs as HTML cards.
// Each card can be screenshotted or the copy text can be copied
// for use in Canva or other design tools.
//
// Gated behind is_admin in the marketing page.
// ═══════════════════════════════════════════════════════════════════════════

interface PostTemplate {
  id: string;
  title: string;
  caption: string; // IG caption text for copy-paste
  render: () => React.ReactNode;
}

const POSTS: PostTemplate[] = [
  // ── 1: Limited Time Pricing ──────────────────────────────────────────
  {
    id: "pricing",
    title: "Limited Time Pricing",
    caption: `🚨 PRO PLAN — LIMITED TIME OFFER

WAS: $99/mo
NOW: $49/mo (Save 50%!)

Lock this in before the next 50 spots fill up. Once they're gone, it goes back to $99.

What you get:
✅ Pre-sold leads delivered to your dashboard
✅ 3D configurator that closes the sale for you
✅ Auto-generated material lists & cut plans
✅ AI marketing scripts for every platform
✅ Passive income referral bounties
✅ Installer community & training library

Stop chasing leads. Start building.
🔗 Link in bio → storage-network.app

#garagestorage #sidehustle #passiveincome #contractor #installer #storageNetwork`,
    render: () => (
      <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
        {/* Logo */}
        <div className="mb-2 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-yellow-400" />
          <span className="text-sm font-black tracking-wider text-yellow-400">STORAGE<span className="text-white">NETWORK</span>.APP</span>
        </div>
        <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.3em] text-yellow-400/60">Pro Plan — Limited Time Offer</p>

        {/* Price */}
        <div className="mb-6">
          <p className="text-lg font-bold text-stone-500">WAS: <span className="line-through decoration-red-500 decoration-2">$99</span></p>
          <p className="text-6xl font-black text-yellow-400">NOW: $49</p>
          <p className="text-xl font-black text-emerald-400">(Save 50%!)</p>
        </div>

        {/* Bullets */}
        <div className="mb-6 space-y-2">
          {[
            "FULL AI SCRIPT GENERATOR ACCESS",
            "EXCLUSIVE PASSIVE INCOME BOUNTIES",
            "QR CODE / MARKETING MATERIAL",
            "PRO COMMUNITY FORUM ACCESS",
            "PRE-SOLD LEADS TO YOUR DASHBOARD",
            "AUTO MATERIAL LISTS & CUT PLANS",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <span className="text-emerald-400 text-sm">✓</span>
              <span className="text-xs font-bold text-white">{item}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto border-t border-slate-700 pt-4">
          <p className="text-center text-sm font-black uppercase tracking-wider text-yellow-400">
            Upgrade now at our site
          </p>
        </div>
      </div>
    ),
  },

  // ── 2: We Close the Sale ─────────────────────────────────────────────
  {
    id: "close-sale",
    title: "We Close the Sale",
    caption: `We Close the Sale. You Build the Project. 🔨

Stop fighting for leads. Stop writing quotes. Stop chasing checks.

Here's how it works:
1️⃣ Customer designs their storage unit in our 3D configurator
2️⃣ They pay a deposit before you're even assigned
3️⃣ You get the job with a full material list + cut plan
4️⃣ Build it. Tap complete. Get paid instantly.

No bidding. No invoicing. No callbacks.

The platform handles the sales so you can focus on what you do best — building.

🔗 storage-network.app
#garagestorage #contractor #sidehustle #passiveincome #storageNetwork`,
    render: () => (
      <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-yellow-400" />
          <span className="text-sm font-black tracking-wider text-yellow-400">STORAGE<span className="text-white">NETWORK</span>.APP</span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <p className="text-5xl font-black leading-[1.1] text-white">
            We Close<br />the Sale.
          </p>
          <p className="mt-2 text-5xl font-black leading-[1.1] text-yellow-400">
            You Build<br />the Project.
          </p>

          <div className="mt-8 space-y-2 text-sm text-stone-400">
            <p>Stop fighting for leads. We handle the design,</p>
            <p>sales, and logistics. You get a confirmed job</p>
            <p>with a cut list and a deposit. No bidding. No</p>
            <p>chasing checks.</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">Installer Network</span>
          <span className="text-yellow-400">→</span>
        </div>
      </div>
    ),
  },

  // ── 3: Passive Income Bounties ───────────────────────────────────────
  {
    id: "bounties",
    title: "Passive Income Bounties",
    caption: `💰 Pro Members Earn Passive Income with Storage Network Bounties

Here's the deal:
1. Share your link anywhere — Facebook, TikTok, Instagram, nationwide
2. Someone outside your area clicks it and books a job
3. We connect them with a local installer
4. YOU earn 30% of the deposit. Minimum $15. Automatically.

You didn't drive there. You didn't build it. You just shared a link.

Sample earnings:
• $50 deposit → $15 bounty
• $150 deposit → $45 bounty
• $300 deposit → $90 bounty
• $500 deposit → $150 bounty

5 referrals/month at avg $200 deposit = $300/mo passive income 💸

🔗 storage-network.app
#passiveincome #sidehustle #garagestorage #referral #storageNetwork`,
    render: () => (
      <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-yellow-400" />
          <span className="text-sm font-black tracking-wider text-yellow-400">STORAGE<span className="text-white">NETWORK</span>.APP</span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <p className="text-[42px] font-black leading-[1.05]">
            <span className="text-white">Pro Members</span><br />
            <span className="text-white">Earn </span>
            <span className="text-yellow-400">Passive<br />Income</span><br />
            <span className="text-white">with Storage</span><br />
            <span className="text-yellow-400">Network<br />Bounties.</span>
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">Installer Network</span>
          <span className="text-yellow-400">→</span>
        </div>
      </div>
    ),
  },

  // ── 4: 3D Configurator ──────────────────────────────────────────────
  {
    id: "configurator",
    title: "Customers See It Before They Buy",
    caption: `Your Customers See It Before They Buy It 👀

No more "can you describe what it looks like?"

Our interactive 3D configurator lets homeowners design their exact storage system — size, layout, tote count — in real time.

When they hit "Order," you've got a confirmed job with zero scope creep.

✅ Eliminates miscommunication — customers see exactly what they're getting
✅ Closes sales faster — average design-to-order time under 3 minutes
✅ Pre-calculated everything — comes with a cut plan and material list

The customer sells themselves. You just build.

🔗 storage-network.app
#garagestorage #3Dconfigurator #contractor #storageNetwork`,
    render: () => (
      <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-yellow-400" />
          <span className="text-sm font-black tracking-wider text-yellow-400">STORAGE<span className="text-white">NETWORK</span>.APP</span>
        </div>

        <p className="mb-6 text-3xl font-black leading-tight text-white">
          Your Customers <span className="text-yellow-400">See It Before They Buy It.</span>
        </p>

        <p className="mb-6 text-xs text-stone-400 leading-relaxed">
          No more &quot;can you describe what it looks like?&quot; Our interactive 3D configurator
          lets homeowners design their exact system — size, layout, tote count — in
          real time. When they hit &quot;Order,&quot; you&apos;ve got a confirmed job with zero scope creep.
        </p>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-black text-yellow-400">Eliminates Miscommunication</p>
            <p className="text-[11px] text-stone-500">Customers see exactly what they&apos;re getting. No callbacks. No change orders.</p>
          </div>
          <div>
            <p className="text-xs font-black text-yellow-400">Closes Sales Faster</p>
            <p className="text-[11px] text-stone-500">Visual confidence turns browsers into buyers. Average design-to-order time under 3 minutes.</p>
          </div>
          <div>
            <p className="text-xs font-black text-yellow-400">Pre-Calculated Everything</p>
            <p className="text-[11px] text-stone-500">Every order generates a Cut Plan and Material List so you show up ready to build.</p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-700 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">3D Visualizer</span>
          <span className="text-yellow-400">→</span>
        </div>
      </div>
    ),
  },

  // ── 5: AI Script Generator ──────────────────────────────────────────
  {
    id: "ai-scripts",
    title: "AI Script Generator",
    caption: `📝 Don't know what to post? We write it for you.

The AI Script Generator creates ready-to-post marketing copy for:
📱 Instagram
🐦 X / Twitter
🌐 Any website or blog
🎵 TikTok
📘 Facebook
💼 LinkedIn

Every script is localized to YOUR area. Just tap "Generate," copy, and paste.

Stop staring at a blank screen. Start posting and getting leads.

🔗 storage-network.app/dashboard/marketing
#marketing #AItools #garagestorage #smallbusiness #storageNetwork`,
    render: () => (
      <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-yellow-400" />
          <span className="text-sm font-black tracking-wider text-yellow-400">STORAGE<span className="text-white">NETWORK</span>.APP</span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <p className="text-[44px] font-black leading-[1.05]">
            <span className="text-yellow-400">AI Script<br />Generator</span>
            <span className="text-white"> for<br />Marketing &amp;<br />Promotion</span>
          </p>
          <p className="mt-4 text-sm font-bold text-yellow-400/70">
            Tailored posts for Social Media
          </p>

          {/* Platform icons row */}
          <div className="mt-6 flex gap-4">
            {["IG", "X", "WEB", "TT", "FB", "IN"].map((p) => (
              <div key={p} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600 text-[10px] font-bold text-stone-400">
                {p}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">Installer Network</span>
          <span className="text-yellow-400">→</span>
        </div>
      </div>
    ),
  },

  // ── 6: Community Forum ──────────────────────────────────────────────
  {
    id: "community",
    title: "Community Forum",
    caption: `Connect. Learn. Grow. 🤝

The Storage Network Community Forum is where installers:
💬 Share build photos and get feedback
🔧 Ask questions about tricky installs
📈 Swap tips on what's working in their market
🎯 Learn from installers who are actively building

This isn't a generic Facebook group. It's a focused, high-signal community of people doing the same work you are.

Pro members only. No spam. No noise.

🔗 storage-network.app/community
#community #garagestorage #contractor #networking #storageNetwork`,
    render: () => (
      <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-yellow-400" />
          <span className="text-sm font-black tracking-wider text-yellow-400">STORAGE<span className="text-white">NETWORK</span>.APP</span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <p className="text-[52px] font-black leading-[1.0]">
            <span className="text-white">Connect.</span><br />
            <span className="text-white">Learn.</span><br />
            <span className="text-white">Grow.</span><br />
            <span className="text-yellow-400">Community<br />Forum for<br />Pro members</span>
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">Installer Network</span>
          <span className="text-yellow-400">→</span>
        </div>
      </div>
    ),
  },

  // ── 7: Pre-Sold Jobs Flow ────────────────────────────────────────────
  {
    id: "presold",
    title: "Pre-Sold Jobs, Explained",
    caption: `How Pre-Sold Jobs Work on Storage Network 📋

SALES — Pre-Sold Jobs
We secure the customer and the deposit. You don't quote. You don't sell. You just build.

PLANNING — No Math
Every job comes with a pre-calculated Material List and Cut List. Show up, cut, assemble.

PAYMENTS — Instant Payout
Job done? Tap "Complete." Funds are sent to your bank account immediately. No invoicing.

That's the whole process:
✅ Customer books and pays deposit
✅ You get a confirmed job + plans
✅ You build it
✅ You get paid instantly

It's that simple.

🔗 storage-network.app
#contractor #garagestorage #presold #sidehustle #storageNetwork`,
    render: () => (
      <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-yellow-400" />
          <span className="text-sm font-black tracking-wider text-yellow-400">STORAGE<span className="text-white">NETWORK</span>.APP</span>
        </div>

        <div className="flex flex-1 flex-col justify-center space-y-6">
          {[
            {
              label: "SALES",
              title: "Pre-Sold Jobs",
              desc: "We secure the customer and the deposit. You don't quote. You don't sell. You just build.",
            },
            {
              label: "PLANNING",
              title: "No Math",
              desc: "Every job comes with a pre-calculated Material List and Cut List. Show up, cut, assemble.",
            },
            {
              label: "PAYMENTS",
              title: "Instant Payout",
              desc: 'Job done? Tap "Complete." Funds are sent to your bank account immediately. No invoicing.',
            },
          ].map((block) => (
            <div key={block.label}>
              <p className="text-xs font-black text-yellow-400">{block.label} <span className="text-white">{block.title}</span></p>
              <p className="mt-1 text-xs text-stone-400 leading-relaxed">{block.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">Installer Network</span>
          <span className="text-yellow-400">→</span>
        </div>
      </div>
    ),
  },

  // ── 8: One Network, Unlimited Opportunities ──────────────────────────
  {
    id: "network",
    title: "The Platform Overview",
    caption: `One Network. Unlimited Opportunities. 🌐

Storage Network is the all-in-one platform for garage storage installers:

🎯 Pre-sold leads delivered to your dashboard
📐 3D configurator that sells the job for you
📋 Auto-generated material lists & cut plans
💳 Instant Stripe payouts — no invoicing
📱 AI marketing tools for every platform
💰 Passive income referral bounties
👥 Installer community & training

Whether you're doing this on weekends or running a full crew — the platform scales with you.

$49/mo. Everything included. No upsells.

🔗 storage-network.app
#garagestorage #platform #contractor #sidehustle #storageNetwork`,
    render: () => (
      <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-yellow-400" />
          <span className="text-sm font-black tracking-wider text-yellow-400">STORAGE<span className="text-white">NETWORK</span>.APP</span>
        </div>

        <p className="mb-2 text-lg font-black text-white">
          <span className="text-yellow-400">One Network.</span> Unlimited Opportunities.
        </p>

        <div className="my-6 grid grid-cols-2 gap-3">
          {[
            { icon: "🎯", label: "Pre-Sold Leads" },
            { icon: "📐", label: "3D Configurator" },
            { icon: "📋", label: "Cut Plans" },
            { icon: "💳", label: "Instant Payouts" },
            { icon: "📱", label: "AI Marketing" },
            { icon: "💰", label: "Bounty Program" },
            { icon: "👥", label: "Community" },
            { icon: "📊", label: "Analytics" },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <span className="text-lg">{f.icon}</span>
              <span className="text-xs font-bold text-stone-300">{f.label}</span>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-yellow-400/10 border border-yellow-400/20 p-3 text-center">
          <p className="text-sm font-black text-yellow-400">$49/mo — Everything Included</p>
          <p className="text-[10px] text-yellow-400/60">Was $99 · Limited time for next 50 installers</p>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-700 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">The Platform</span>
          <span className="text-yellow-400">→</span>
        </div>
      </div>
    ),
  },

  // ── 9: Material Lists & Cut Plans ─────────────────────────────────────
  {
    id: "cutplans",
    title: "Material Lists & Cut Plans",
    caption: `Show Up. Cut. Assemble. Everything Pre-Calculated. 📋✂️

Every job on Storage Network comes with:

📦 MATERIAL LIST
• Exact quantities — 2x4s, plywood sheets, screws, totes
• No guessing at the lumber yard
• Accounts for your existing inventory

✂️ CUT PLAN
• Board-by-board diagrams with fractional measurements
• Color-coded cuts so you know what goes where
• Waste tracking to minimize scrap

You walk into Home Depot knowing EXACTLY what to grab. You get to the job site knowing EXACTLY where to cut.

No spreadsheets. No math. Just build.

🔗 storage-network.app
#garagestorage #cutplan #materiallist #contractor #storageNetwork`,
    render: () => (
      <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-yellow-400" />
          <span className="text-sm font-black tracking-wider text-yellow-400">STORAGE<span className="text-white">NETWORK</span>.APP</span>
        </div>

        <p className="mb-6 text-3xl font-black leading-tight text-white">
          Show Up. Cut.<br />Assemble.<br />
          <span className="text-yellow-400">Everything Pre-Calculated.</span>
        </p>

        <div className="space-y-4 flex-1">
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <p className="text-xs font-black text-yellow-400 mb-2">📦 MATERIAL LIST</p>
            <ul className="space-y-1 text-[11px] text-stone-400">
              <li>• Exact quantities — 2x4s, plywood, screws, totes</li>
              <li>• No guessing at the lumber yard</li>
              <li>• Accounts for existing inventory</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <p className="text-xs font-black text-yellow-400 mb-2">✂️ CUT PLAN</p>
            <ul className="space-y-1 text-[11px] text-stone-400">
              <li>• Board-by-board with fractional measurements</li>
              <li>• Color-coded cuts per module</li>
              <li>• Waste tracking to minimize scrap</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">Installer Network</span>
          <span className="text-yellow-400">→</span>
        </div>
      </div>
    ),
  },

  // ── 10: Auto-Marketing Coming Soon ──────────────────────────────────
  {
    id: "auto-marketing",
    title: "Auto-Marketing Agent (Coming Soon)",
    caption: `⚡ Coming Soon: AI That Markets Your Business FOR You

We're building an Auto-Marketing Agent exclusively for Pro subscribers.

Here's what it does:
🤖 Automatically generates SEO-optimized pages for your business
📍 Showcases your portfolio, services, and service area
🔍 Drives organic traffic and leads directly to your profile
✋ Zero effort on your end — the agent handles everything

Pair this with the referral bounty system and your passive income potential goes through the roof.

This is the future of installer marketing. And it's included in your Pro subscription.

Stay tuned. 👀

🔗 storage-network.app
#AI #marketing #garagestorage #automation #storageNetwork`,
    render: () => (
      <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-yellow-400" />
          <span className="text-sm font-black tracking-wider text-yellow-400">STORAGE<span className="text-white">NETWORK</span>.APP</span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-4 inline-flex self-start rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1">
            <span className="text-xs font-black text-yellow-400">⚡ COMING SOON</span>
          </div>

          <p className="text-[40px] font-black leading-[1.05]">
            <span className="text-yellow-400">AI That<br />Markets<br />Your Business</span><br />
            <span className="text-white">FOR You.</span>
          </p>

          <div className="mt-6 space-y-2">
            {[
              "Auto-generates SEO pages for your business",
              "Showcases portfolio & service area",
              "Drives organic leads to your profile",
              "Zero effort — the agent handles everything",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="text-emerald-400 text-xs">✓</span>
                <span className="text-xs text-stone-400">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">Pro Subscribers</span>
          <span className="text-yellow-400">→</span>
        </div>
      </div>
    ),
  },
];

// ── Component ────────────────────────────────────────────────────────────

export default function IGSalesImages() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  function copyCaption(post: PostTemplate) {
    navigator.clipboard.writeText(post.caption);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const post = POSTS[selectedIdx];

  return (
    <section className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/5 to-slate-900 p-5">
      <div className="mb-1 flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-cyan-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          IG Sales Images
        </h2>
        <span className="rounded bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-cyan-400">
          Admin
        </span>
      </div>
      <p className="mb-6 text-sm text-stone-500">
        Screenshot these posts or copy the caption for Canva. {POSTS.length} templates ready to go.
      </p>

      {/* Thumbnail strip */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {POSTS.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setSelectedIdx(i)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-[10px] font-bold transition-all ${
              selectedIdx === i
                ? "border-yellow-400/50 bg-yellow-400/10 text-yellow-400"
                : "border-slate-700 bg-slate-800 text-stone-500 hover:text-white"
            }`}
          >
            {i + 1}. {p.title.length > 18 ? p.title.slice(0, 18) + "…" : p.title}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
          disabled={selectedIdx === 0}
          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-stone-400 transition-colors hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="h-3 w-3" /> Prev
        </button>
        <span className="text-xs text-stone-600">{selectedIdx + 1} / {POSTS.length}</span>
        <button
          onClick={() => setSelectedIdx(Math.min(POSTS.length - 1, selectedIdx + 1))}
          disabled={selectedIdx === POSTS.length - 1}
          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-stone-400 transition-colors hover:text-white disabled:opacity-30"
        >
          Next <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Post Preview — 1:1 aspect ratio */}
      <div
        ref={cardRef}
        className="relative mx-auto aspect-square w-full max-w-[400px] overflow-hidden rounded-xl border border-slate-700"
      >
        {post.render()}
      </div>

      {/* Post title + actions */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-bold text-white">{post.title}</p>
        <div className="flex gap-2">
          <button
            onClick={() => copyCaption(post)}
            className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
          >
            {copiedId === post.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedId === post.id ? "Copied!" : "Copy Caption"}
          </button>
        </div>
      </div>

      {/* Caption preview */}
      <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800 p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
          Instagram Caption
        </p>
        <pre className="whitespace-pre-wrap text-xs text-stone-400 leading-relaxed font-sans max-h-48 overflow-y-auto">
          {post.caption}
        </pre>
      </div>

      {/* Tip */}
      <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
        <p className="text-[10px] text-stone-500">
          <span className="font-bold text-stone-400">Tip:</span> Screenshot the preview above for a quick post, or copy the caption and pair it with your own visuals in Canva. Post one per day for consistent reach.
        </p>
      </div>
    </section>
  );
}
