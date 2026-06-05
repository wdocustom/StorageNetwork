"use client";

import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Sparkles,
  User,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// InstallerPostTemplates — Personalized IG posts from the installer's POV
//
// Generates 10 ready-to-post IG templates written as if the installer
// is speaking directly to potential customers. Dynamically injects:
//   - Business name / first name
//   - City, State
//   - Booking link (slug-based)
//
// Admin-only for now. Renders above IGSalesImages in marketing page.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  businessName: string | null;
  city: string | null;
  state: string | null;
  bookingLink: string;
}

interface PostTemplate {
  id: string;
  title: string;
  getCaption: (biz: string, loc: string, link: string) => string;
  render: (biz: string, loc: string, link: string) => React.ReactNode;
}

// Shared footer bar for all cards
function CardFooter({ biz }: { biz: string }) {
  return (
    <div className="flex items-center justify-between border-t border-zinc-700 pt-4">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600 truncate max-w-[70%]">{biz}</span>
      <span className="text-yellow-400">→</span>
    </div>
  );
}

function buildPosts(): PostTemplate[] {
  return [
    // ── 1: Garage Transformation CTA ───────────────────────────────────
    {
      id: "transform",
      title: "Garage Transformation",
      getCaption: (biz, loc, link) =>
`Is your garage a disaster? Let's fix that. 🔧

I build custom tote-based garage storage systems in ${loc}. You pick the layout, I build it — usually in under a day.

Here's how it works:
1️⃣ Click my link and design your setup in 3D
2️⃣ See the exact price — no hidden fees
3️⃣ I show up with everything pre-cut and ready to install

No more guessing. No more piles. Just clean, organized storage.

Design yours now 👇
🔗 ${link}

#garagestorage #${loc.split(",")[0]?.trim().toLowerCase().replace(/\s+/g, "")} #homeorganization #garagegoals #declutter`,
      render: (biz, loc) => (
        <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-yellow-400" />
            <span className="text-sm font-black tracking-wider text-yellow-400">{biz.toUpperCase()}</span>
          </div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600">{loc}</p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[44px] font-black leading-[1.05] text-white">
              Your Garage<br />Deserves<br /><span className="text-yellow-400">Better.</span>
            </p>
            <p className="mt-6 text-sm text-stone-400 leading-relaxed">
              Custom tote storage systems built &amp; installed in a day.<br />
              Design yours in 3D. See the price instantly. I handle the rest.
            </p>
          </div>
          <CardFooter biz={biz} />
        </div>
      ),
    },

    // ── 2: Before/After Style ──────────────────────────────────────────
    {
      id: "before-after",
      title: "Before & After",
      getCaption: (biz, loc, link) =>
`The transformation is always the best part. 📸

Another garage in ${loc} — from chaos to completely organized. Tote-based storage system custom-built to fit the space.

Every project includes:
✅ 3D design preview before I start
✅ Pre-cut materials — no guesswork
✅ Installed in one visit

If your garage looks like the "before," let's make it the "after."

Design your layout here 👇
🔗 ${link}

#beforeandafter #garagestorage #garageorganization #${loc.split(",")[0]?.trim().toLowerCase().replace(/\s+/g, "")} #homeimprovement`,
      render: (biz, loc) => (
        <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-yellow-400" />
            <span className="text-sm font-black tracking-wider text-yellow-400">{biz.toUpperCase()}</span>
          </div>
          <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600">{loc}</p>
          <div className="flex flex-1 items-center gap-4">
            <div className="flex-1 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center h-40 flex flex-col justify-center">
              <p className="text-3xl mb-2">😬</p>
              <p className="text-xs font-black text-red-400 uppercase">Before</p>
              <p className="text-[10px] text-stone-500 mt-1">Cluttered. Stacked. Can&apos;t find anything.</p>
            </div>
            <div className="text-2xl text-yellow-400 font-black">→</div>
            <div className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center h-40 flex flex-col justify-center">
              <p className="text-3xl mb-2">🤩</p>
              <p className="text-xs font-black text-emerald-400 uppercase">After</p>
              <p className="text-[10px] text-stone-500 mt-1">Clean. Organized. Everything accessible.</p>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-stone-400">
            Design yours in 3D. I&apos;ll build it.
          </p>
          <CardFooter biz={biz} />
        </div>
      ),
    },

    // ── 3: Pricing Transparency ────────────────────────────────────────
    {
      id: "pricing",
      title: "Transparent Pricing",
      getCaption: (biz, loc, link) =>
`No quotes. No estimates. No surprises. 💰

When you design your garage storage system through my link, you see the EXACT price before you commit. Not a range. Not "starting at." The actual price.

What's included:
• Custom 3D design you control
• All materials + hardware
• Professional installation by me in ${loc}
• Pre-cut lumber — precision built

I don't show up and upsell. What you see is what you pay.

Build your design and see the price 👇
🔗 ${link}

#transparentpricing #garagestorage #${loc.split(",")[0]?.trim().toLowerCase().replace(/\s+/g, "")} #noBS #honestpricing`,
      render: (biz, loc) => (
        <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-yellow-400" />
            <span className="text-sm font-black tracking-wider text-yellow-400">{biz.toUpperCase()}</span>
          </div>
          <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600">{loc}</p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-4xl font-black leading-tight text-white">
              No Quotes.<br />No Estimates.<br /><span className="text-yellow-400">No Surprises.</span>
            </p>
            <p className="mt-6 text-sm text-stone-400 leading-relaxed">
              Design your storage system in 3D and see the exact price before you commit. Not a range — the real number.
            </p>
            <div className="mt-6 rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-3 text-center">
              <p className="text-xs font-bold text-yellow-400">What you see = What you pay</p>
            </div>
          </div>
          <CardFooter biz={biz} />
        </div>
      ),
    },

    // ── 4: Same-Day Install ─────────────────────────────────────────────
    {
      id: "same-day",
      title: "Same-Day Install",
      getCaption: (biz, loc, link) =>
`Most installs done in one visit. Seriously. ⚡

I don't show up and "figure it out." Every project is pre-planned with exact measurements, pre-cut lumber, and a full material list before I even knock on your door.

That's why most builds in ${loc} are done the same day:
🪵 Pre-cut 2x4 frames
📋 Color-coded build plan
🔩 Every screw counted
📦 Totes included

From bare wall to fully organized — usually a few hours.

Ready? Design yours here 👇
🔗 ${link}

#samedayinstall #garagestorage #${loc.split(",")[0]?.trim().toLowerCase().replace(/\s+/g, "")} #organizedgarage #homeproject`,
      render: (biz, loc) => (
        <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-yellow-400" />
            <span className="text-sm font-black tracking-wider text-yellow-400">{biz.toUpperCase()}</span>
          </div>
          <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600">{loc}</p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[42px] font-black leading-[1.05] text-white">
              Installed<br />in <span className="text-yellow-400">One Day.</span>
            </p>
            <div className="mt-6 space-y-2">
              {[
                "Pre-cut lumber — no sawing on-site",
                "Color-coded build plan",
                "Every screw counted",
                "Totes included & organized",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="text-yellow-400 text-xs">⚡</span>
                  <span className="text-xs text-stone-300">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-stone-500">
              From bare wall to fully organized — usually a few hours.
            </p>
          </div>
          <CardFooter biz={biz} />
        </div>
      ),
    },

    // ── 5: Design It Yourself ──────────────────────────────────────────
    {
      id: "design-it",
      title: "Design It Yourself in 3D",
      getCaption: (biz, loc, link) =>
`You design it. I build it. Simple. 🎨

My customers in ${loc} don't wait for a quote. They click my link, open the 3D designer, and build their exact storage layout:

📐 Choose your wall size
📦 Pick your totes (HDX or Greenmade)
🎨 Select colors
💰 See the price update in real-time

When you're happy with the design, lock it in. I show up with everything pre-cut and install it.

No back and forth. No "let me get back to you." You're in control.

Try the designer 👇
🔗 ${link}

#3Ddesign #garagestorage #${loc.split(",")[0]?.trim().toLowerCase().replace(/\s+/g, "")} #DIY #customstorage`,
      render: (biz, loc) => (
        <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-yellow-400" />
            <span className="text-sm font-black tracking-wider text-yellow-400">{biz.toUpperCase()}</span>
          </div>
          <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600">{loc}</p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-4xl font-black leading-tight text-white">
              You <span className="text-yellow-400">Design It.</span><br />
              I <span className="text-yellow-400">Build It.</span>
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              {[
                { icon: "📐", label: "Choose wall size" },
                { icon: "📦", label: "Pick your totes" },
                { icon: "🎨", label: "Select colors" },
                { icon: "💰", label: "See price live" },
              ].map((f) => (
                <div key={f.label} className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 flex items-center gap-2">
                  <span className="text-base">{f.icon}</span>
                  <span className="text-[11px] font-bold text-stone-300">{f.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-stone-500">
              No back and forth. No &quot;let me get back to you.&quot; You&apos;re in control.
            </p>
          </div>
          <CardFooter biz={biz} />
        </div>
      ),
    },

    // ── 6: Tote-Based Explanation ──────────────────────────────────────
    {
      id: "tote-system",
      title: "What Is Tote Storage?",
      getCaption: (biz, loc, link) =>
`"What even is tote-based storage?" Great question. 🤔

Instead of shelves that collect junk, tote storage uses heavy-duty bins that slide in and out of a custom-built frame. Think of it like a filing cabinet for your garage.

Why homeowners in ${loc} love it:
✅ Everything has a place — no more piles
✅ Bins pull out so you can actually reach things
✅ Stackable, modular, and looks incredible
✅ Way cheaper than custom cabinet systems

I design the frame to fit your garage wall. You pick how many totes, what layout, wheels or no wheels — all in a 3D designer.

See how it works 👇
🔗 ${link}

#totestorage #garageorganization #${loc.split(",")[0]?.trim().toLowerCase().replace(/\s+/g, "")} #storagehacks #organizedhome`,
      render: (biz, loc) => (
        <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-yellow-400" />
            <span className="text-sm font-black tracking-wider text-yellow-400">{biz.toUpperCase()}</span>
          </div>
          <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600">{loc}</p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-3xl font-black leading-tight text-white">
              What Is <span className="text-yellow-400">Tote-Based Storage?</span>
            </p>
            <p className="mt-4 text-xs text-stone-400 leading-relaxed">
              Heavy-duty bins that slide in and out of a custom-built wood frame. Think of it like a filing cabinet for your garage.
            </p>
            <div className="mt-5 space-y-2">
              {[
                "Everything has a place — no more piles",
                "Bins pull out so you can reach things",
                "Modular — add more anytime",
                "Way cheaper than custom cabinets",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="text-emerald-400 text-xs">✓</span>
                  <span className="text-xs text-stone-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <CardFooter biz={biz} />
        </div>
      ),
    },

    // ── 7: Weekend Project ─────────────────────────────────────────────
    {
      id: "weekend",
      title: "This Weekend's Project",
      getCaption: (biz, loc, link) =>
`What are you doing this weekend? 🗓️

While you're thinking about it — I could have your garage completely organized. One visit. A few hours. Done.

Here's what recent customers in ${loc} are saying:
"We can finally park both cars in the garage."
"I didn't realize how much space we had."
"Should have done this years ago."

The best part? You design it yourself in 3D before I even come out. You know exactly what you're getting and exactly what it costs.

Stop putting it off. Design yours 👇
🔗 ${link}

#weekendproject #garagestorage #${loc.split(",")[0]?.trim().toLowerCase().replace(/\s+/g, "")} #getitdone #homegoals`,
      render: (biz, loc) => (
        <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-yellow-400" />
            <span className="text-sm font-black tracking-wider text-yellow-400">{biz.toUpperCase()}</span>
          </div>
          <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600">{loc}</p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[42px] font-black leading-[1.05] text-white">
              This<br />Weekend&apos;s<br /><span className="text-yellow-400">Project?</span>
            </p>
            <p className="mt-4 text-lg font-black text-yellow-400">Done.</p>
            <p className="mt-4 text-sm text-stone-400 leading-relaxed">
              One visit. A few hours. Your garage — completely organized.
            </p>
            <div className="mt-5 space-y-2 text-xs text-stone-500 italic">
              <p>&quot;We can finally park both cars in the garage.&quot;</p>
              <p>&quot;Should have done this years ago.&quot;</p>
            </div>
          </div>
          <CardFooter biz={biz} />
        </div>
      ),
    },

    // ── 8: How Much Does It Cost ───────────────────────────────────────
    {
      id: "cost",
      title: "How Much Does It Cost?",
      getCaption: (biz, loc, link) =>
`"How much does garage storage cost?" 💰

It depends on your layout — but here's the cool part: you don't have to ask me. You can design it yourself and see the price in real time.

Typical projects in ${loc}:
• Small wall (4ft) — starting around $250-400
• Full wall (8-12ft) — usually $500-900
• Double wall / L-shape — $800-1,500+

Every project includes the frame, totes, hardware, and installation. No hidden fees. No change orders.

The price you see in the designer is the price you pay. Period.

Try the designer — it's free to play with 👇
🔗 ${link}

#garagestoragecost #pricing #${loc.split(",")[0]?.trim().toLowerCase().replace(/\s+/g, "")} #homeimprovement #garagegoals`,
      render: (biz, loc) => (
        <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-yellow-400" />
            <span className="text-sm font-black tracking-wider text-yellow-400">{biz.toUpperCase()}</span>
          </div>
          <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600">{loc}</p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-3xl font-black leading-tight text-white">
              &quot;How Much Does<br />It <span className="text-yellow-400">Cost?</span>&quot;
            </p>
            <div className="mt-6 space-y-2">
              {[
                { size: "Small wall (4ft)", price: "$250-400" },
                { size: "Full wall (8-12ft)", price: "$500-900" },
                { size: "Double / L-shape", price: "$800-1,500+" },
              ].map((row) => (
                <div key={row.size} className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2.5">
                  <span className="text-xs text-stone-400">{row.size}</span>
                  <span className="text-sm font-black text-yellow-400">{row.price}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-stone-500">
              Includes frame, totes, hardware &amp; installation. The price you see is the price you pay.
            </p>
          </div>
          <CardFooter biz={biz} />
        </div>
      ),
    },

    // ── 9: Serving [City] ──────────────────────────────────────────────
    {
      id: "serving",
      title: "Now Serving Your Area",
      getCaption: (biz, loc, link) =>
`📍 Now serving ${loc} and surrounding areas!

If you've been thinking about organizing your garage — this is your sign.

I build custom tote-based storage systems that:
🔧 Fit any wall size
📦 Use heavy-duty bins (HDX or Greenmade)
🪵 Built with real lumber — no cheap plastic shelving
⚡ Installed in a single visit

Every project is pre-designed in 3D so you know exactly what you're getting.

Spots fill up fast. Design yours today 👇
🔗 ${link}

#${loc.split(",")[0]?.trim().toLowerCase().replace(/\s+/g, "")} #garagestorage #localinstaller #nowserving #homeorganization`,
      render: (biz, loc) => (
        <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-yellow-400" />
            <span className="text-sm font-black tracking-wider text-yellow-400">{biz.toUpperCase()}</span>
          </div>
          <div className="flex flex-1 flex-col justify-center">
            <div className="mb-4 inline-flex self-start rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1">
              <span className="text-xs font-black text-yellow-400">📍 NOW SERVING</span>
            </div>
            <p className="text-[44px] font-black leading-[1.05] text-yellow-400">
              {loc.split(",")[0]?.trim() || "Your Area"}
            </p>
            <p className="text-xl font-black text-stone-500">{loc.split(",")[1]?.trim() || ""}</p>
            <p className="mt-6 text-sm text-stone-400 leading-relaxed">
              Custom tote-based storage systems. Designed in 3D. Installed in one visit.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {["Any wall size", "Heavy-duty bins", "Real lumber", "Single visit"].map((f) => (
                <div key={f} className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-center">
                  <span className="text-[11px] font-bold text-stone-300">{f}</span>
                </div>
              ))}
            </div>
          </div>
          <CardFooter biz={biz} />
        </div>
      ),
    },

    // ── 10: Stop Stacking, Start Organizing ────────────────────────────
    {
      id: "stop-stacking",
      title: "Stop Stacking, Start Organizing",
      getCaption: (biz, loc, link) =>
`Stop stacking. Start organizing. 📦

You know that corner of the garage where everything just... piles up? The holiday decorations, the tools, the kid stuff, the "I'll deal with it later" stuff?

I turn that into this:
→ A clean, custom-built storage wall
→ Every bin labeled and accessible
→ No more digging through piles
→ Looks like a showroom

I'm an installer in ${loc} and I've done this for dozens of garages. It takes a few hours and the difference is night and day.

See what yours would look like 👇
🔗 ${link}

#stopstacking #garagestorage #declutter #${loc.split(",")[0]?.trim().toLowerCase().replace(/\s+/g, "")} #organizedlife`,
      render: (biz, loc) => (
        <div className="flex h-full w-full flex-col bg-[#0a0e17] p-10">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-yellow-400" />
            <span className="text-sm font-black tracking-wider text-yellow-400">{biz.toUpperCase()}</span>
          </div>
          <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600">{loc}</p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[42px] font-black leading-[1.05]">
              <span className="text-stone-500">Stop<br />Stacking.</span><br />
              <span className="text-yellow-400">Start<br />Organizing.</span>
            </p>
            <div className="mt-6 space-y-2">
              {[
                "Custom-built storage wall",
                "Every bin labeled & accessible",
                "No more digging through piles",
                "Installed in a few hours",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="text-yellow-400 text-xs">→</span>
                  <span className="text-xs text-stone-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <CardFooter biz={biz} />
        </div>
      ),
    },
  ];
}

// ── Component ────────────────────────────────────────────────────────────

export default function InstallerPostTemplates({ businessName, city, state, bookingLink }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const POSTS = buildPosts();

  const biz = businessName || "Your Business";
  const loc = [city, state].filter(Boolean).join(", ") || "Your Area";

  function copyCaption(post: PostTemplate) {
    navigator.clipboard.writeText(post.getCaption(biz, loc, bookingLink));
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const post = POSTS[selectedIdx];

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-zinc-900 p-5">
      <div className="mb-1 flex items-center gap-2">
        <User className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          Your Customer Posts
        </h2>
        <span className="rounded bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-400">
          Admin
        </span>
      </div>
      <p className="mb-2 text-sm text-stone-500">
        Personalized posts written from <span className="font-semibold text-amber-400">{biz}</span>&apos;s perspective to attract customers in <span className="font-semibold text-amber-400">{loc}</span>.
      </p>
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2">
        <Sparkles className="h-3 w-3 text-yellow-400 shrink-0" />
        <p className="text-[10px] text-stone-500">
          These include your booking link: <span className="text-blue-400 font-mono break-all">{bookingLink}</span>
        </p>
      </div>

      {/* Thumbnail strip */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {POSTS.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setSelectedIdx(i)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-[10px] font-bold transition-all ${
              selectedIdx === i
                ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                : "border-zinc-700 bg-zinc-800 text-stone-500 hover:text-white"
            }`}
          >
            {i + 1}. {p.title.length > 16 ? p.title.slice(0, 16) + "…" : p.title}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
          disabled={selectedIdx === 0}
          className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-stone-400 transition-colors hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="h-3 w-3" /> Prev
        </button>
        <span className="text-xs text-stone-600">{selectedIdx + 1} / {POSTS.length}</span>
        <button
          onClick={() => setSelectedIdx(Math.min(POSTS.length - 1, selectedIdx + 1))}
          disabled={selectedIdx === POSTS.length - 1}
          className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-stone-400 transition-colors hover:text-white disabled:opacity-30"
        >
          Next <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Post Preview — 1:1 aspect ratio */}
      <div className="relative mx-auto aspect-square w-full max-w-[400px] overflow-hidden rounded-xl border border-zinc-700">
        {post.render(biz, loc, bookingLink)}
      </div>

      {/* Post title + actions */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-bold text-white">{post.title}</p>
        <button
          onClick={() => copyCaption(post)}
          className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
        >
          {copiedId === post.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copiedId === post.id ? "Copied!" : "Copy Caption"}
        </button>
      </div>

      {/* Caption preview */}
      <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-800 p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
          Instagram Caption — Personalized
        </p>
        <pre className="whitespace-pre-wrap text-xs text-stone-400 leading-relaxed font-sans max-h-48 overflow-y-auto">
          {post.getCaption(biz, loc, bookingLink)}
        </pre>
      </div>
    </section>
  );
}
