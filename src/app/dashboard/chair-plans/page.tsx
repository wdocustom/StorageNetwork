import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, CheckCircle } from "lucide-react";
import {
  checkChairPlanAccess,
  verifyChairPlanPurchase,
  verifyChairBundlePurchase,
  verifyChairTemplatePurchase,
} from "@/app/actions/chair-plans";
import PrintButton from "./PrintButton";
import TemplateUpsell from "./TemplateUpsell";

// ── Photo slots ─────────────────────────────────────────────────────────────
// Add images to /public/images/chair-plans/ and update the paths below.
// Null = show placeholder box.
const PHOTOS: Record<string, string | null> = {
  step1: null, // e.g. "/images/chair-plans/step-1-pocket-holes.jpg"
  step2: null, // "/images/chair-plans/step-2-attach-support.jpg"
  step3: null, // "/images/chair-plans/step-3-back-slats.jpg"
  step4: null, // "/images/chair-plans/step-4-seat-slats.jpg"
  step5: null, // "/images/chair-plans/step-5-legs.jpg"
  step6: null, // "/images/chair-plans/step-6-armrests.jpg"
};

function PhotoSlot({ src, label }: { src: string | null; label: string }) {
  if (src) {
    return (
      <div className="flex-1 overflow-hidden rounded-lg border border-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className="flex flex-1 min-h-[160px] items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-center p-4">
      <div>
        <div className="text-2xl mb-1">📸</div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-[10px] text-slate-400 mt-1">Photo coming soon</p>
      </div>
    </div>
  );
}

// ── SVG Cut Profile diagrams ──────────────────────────────────────────────

function BaseProfileSVG() {
  return (
    <svg viewBox="0 0 850 160" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      <text x="0" y="15" fontSize="12" fontWeight="bold" fill="#666">STEP 1: MARK &amp; CUT (38" × 7.5" BOARD)</text>
      <g transform="translate(0, 40)">
        <rect x="0" y="0" width="380" height="75" fill="#fcfcfc" stroke="#aaa" strokeWidth="2"/>
        <polygon points="0,50 0,35 195,0 380,35 360,75 65,75"
          fill="#F5D033" fillOpacity="0.15" stroke="#e03e2d" strokeDasharray="4 4" strokeWidth="2"/>
        <circle cx="195" cy="0" r="4" fill="#e03e2d"/>
        <text x="195" y="-8" fontSize="10" textAnchor="middle" fill="#e03e2d">19.5" from left</text>
        <circle cx="0" cy="35" r="4" fill="#e03e2d"/>
        <text x="-5" y="32" fontSize="10" textAnchor="end" fill="#e03e2d">3.5" down</text>
        <circle cx="0" cy="50" r="4" fill="#e03e2d"/>
        <text x="-5" y="54" fontSize="10" textAnchor="end" fill="#e03e2d">5" down</text>
        <circle cx="65" cy="75" r="4" fill="#e03e2d"/>
        <text x="65" y="90" fontSize="10" textAnchor="middle" fill="#e03e2d">6.5" in</text>
        <circle cx="360" cy="75" r="4" fill="#e03e2d"/>
        <text x="360" y="90" fontSize="10" textAnchor="middle" fill="#e03e2d">2" in</text>
        <circle cx="380" cy="35" r="4" fill="#e03e2d"/>
        <text x="385" y="38" fontSize="10" textAnchor="start" fill="#e03e2d">3.5" down</text>
      </g>
      <text x="450" y="15" fontSize="12" fontWeight="bold" fill="#666">STEP 2: FINAL PIECE</text>
      <g transform="translate(450, 40)">
        <polygon points="0,50 0,35 195,0 380,35 360,75 65,75" fill="#F5D033" stroke="#111" strokeWidth="2"/>
        <g transform="translate(30, 85) rotate(13)">
          <text fontSize="10" fontWeight="bold" fill="#666" letterSpacing="2">GROUND</text>
        </g>
      </g>
    </svg>
  );
}

function LegProfileSVG() {
  return (
    <svg viewBox="0 0 850 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      <text x="0" y="15" fontSize="12" fontWeight="bold" fill="#666">STEP 1: MARK &amp; CUT (20.25" × 5.5" BOARD)</text>
      <g transform="translate(0, 30)">
        <rect x="0" y="0" width="303" height="82" fill="#fcfcfc" stroke="#aaa" strokeWidth="2"/>
        <polygon points="21,0 303,0 282,82 0,82"
          fill="#F5D033" fillOpacity="0.15" stroke="#e03e2d" strokeDasharray="4 4" strokeWidth="2"/>
        <circle cx="21" cy="0" r="4" fill="#e03e2d"/>
        <text x="21" y="-8" fontSize="10" textAnchor="middle" fill="#e03e2d">1-3/8" in</text>
        <circle cx="282" cy="82" r="4" fill="#e03e2d"/>
        <text x="282" y="98" fontSize="10" textAnchor="middle" fill="#e03e2d">1-3/8" in</text>
      </g>
      <text x="450" y="15" fontSize="12" fontWeight="bold" fill="#666">STEP 2: FINAL PIECE</text>
      <g transform="translate(450, 30)">
        <polygon points="21,0 303,0 282,82 0,82" fill="#F5D033" stroke="#111" strokeWidth="2"/>
        <g transform="translate(315, 60) rotate(-76)">
          <text fontSize="10" fontWeight="bold" fill="#666" letterSpacing="2">GROUND</text>
        </g>
      </g>
    </svg>
  );
}

function ArmRestProfileSVG() {
  return (
    <svg viewBox="0 0 850 170" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      <text x="0" y="15" fontSize="12" fontWeight="bold" fill="#666">STEP 1: MARK &amp; CUT (24.25" × 4" RIPPED BOARD)</text>
      <g transform="translate(0, 30)">
        <rect x="0" y="0" width="363" height="60" fill="#fcfcfc" stroke="#aaa" strokeWidth="2"/>
        <polygon points="0,0 363,0 363,36 217,60 0,60"
          fill="#F5D033" fillOpacity="0.15" stroke="#e03e2d" strokeDasharray="4 4" strokeWidth="2"/>
        <circle cx="217" cy="60" r="4" fill="#e03e2d"/>
        <text x="217" y="75" fontSize="10" textAnchor="middle" fill="#e03e2d">14.5" from front</text>
        <circle cx="363" cy="36" r="4" fill="#e03e2d"/>
        <text x="373" y="39" fontSize="10" textAnchor="start" fill="#e03e2d">Mark 2-3/8" wide</text>
        <text x="180" y="15" fontSize="10" fill="#888" fontStyle="italic">Interior Edge (Closest to Seat)</text>
      </g>
      <text x="450" y="15" fontSize="12" fontWeight="bold" fill="#666">STEP 2: RADIUS &amp; PILOT HOLES</text>
      <g transform="translate(450, 30)">
        <path d="M 0,0 L 363,0 L 363,36 L 217,60 L 0,60 Z" fill="#F5D033" stroke="#111" strokeWidth="2"/>
        <text x="370" y="20" fontSize="10" fill="#666" fontWeight="bold">BACK</text>
        <path d="M 0,15 Q 0,0 15,0" fill="none" stroke="#2196F3" strokeWidth="2" strokeDasharray="4 2"/>
        <path d="M 0,45 Q 0,60 15,60" fill="none" stroke="#2196F3" strokeWidth="2" strokeDasharray="4 2"/>
        <line x1="-15" y1="10" x2="5" y2="5" stroke="#2196F3" strokeWidth="1"/>
        <text x="-18" y="10" fontSize="9" fill="#2196F3" textAnchor="end">1" rad</text>
        <line x1="-15" y1="50" x2="5" y2="55" stroke="#2196F3" strokeWidth="1"/>
        <text x="-18" y="50" fontSize="9" fill="#2196F3" textAnchor="end">1" rad</text>
        <circle cx="40" cy="11" r="3" fill="#fff" stroke="#2196F3" strokeWidth="1.5"/>
        <circle cx="65" cy="11" r="3" fill="#fff" stroke="#2196F3" strokeWidth="1.5"/>
        <circle cx="90" cy="11" r="3" fill="#fff" stroke="#2196F3" strokeWidth="1.5"/>
        <line x1="65" y1="0" x2="65" y2="11" stroke="#2196F3" strokeWidth="1" strokeDasharray="2 2"/>
        <text x="65" y="-6" fontSize="9" fill="#2196F3" textAnchor="middle">.75" from interior edge</text>
      </g>
    </svg>
  );
}

function BackSupportProfileSVG() {
  return (
    <svg viewBox="0 0 850 145" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      <text x="0" y="15" fontSize="12" fontWeight="bold" fill="#666">STEP 1: MARK &amp; CUT (17.5" × 4.25" RIPPED BOARD)</text>
      <g transform="translate(0, 35)">
        <rect x="0" y="0" width="262" height="82" fill="#fcfcfc" stroke="#aaa" strokeWidth="2"/>
        <polygon points="0,0 262,0 262,63 0,45"
          fill="#F5D033" fillOpacity="0.15" stroke="#e03e2d" strokeDasharray="4 4" strokeWidth="2"/>
        <circle cx="0" cy="45" r="4" fill="#e03e2d"/>
        <text x="-8" y="48" fontSize="10" textAnchor="end" fill="#e03e2d">Mark at 3"</text>
        <circle cx="262" cy="63" r="4" fill="#e03e2d"/>
        <text x="270" y="66" fontSize="10" textAnchor="start" fill="#e03e2d">Mark at 4.25"</text>
        <line x1="0" y1="45" x2="262" y2="63" stroke="#e03e2d" strokeWidth="1.5" strokeDasharray="4 4"/>
      </g>
      <text x="450" y="15" fontSize="12" fontWeight="bold" fill="#666">STEP 2: FINAL PIECE</text>
      <g transform="translate(450, 35)">
        <polygon points="0,0 262,0 262,63 0,45" fill="#F5D033" stroke="#111" strokeWidth="2"/>
      </g>
    </svg>
  );
}

// ── Assembly step component ───────────────────────────────────────────────

function AssemblyStep({
  number,
  title,
  children,
  photoKey,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
  photoKey: keyof typeof PHOTOS;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#111] text-[#F5D033] font-bold text-sm">
            {number}
          </div>
          <h3 className="font-bold text-[#111] text-base">{title}</h3>
        </div>
        <div className="rounded-r-lg border-l-4 border-slate-200 bg-[#fcfcfc] p-4 text-sm leading-relaxed text-slate-700">
          {children}
        </div>
      </div>
      <PhotoSlot src={PHOTOS[photoKey]} label={`Step ${number}`} />
    </div>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-bold text-[#111] bg-amber-50 px-1 py-0.5 rounded text-xs">
      {children}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function ChairPlansPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const sessionId = typeof searchParams.session_id === "string" ? searchParams.session_id : null;
  const purchaseType = typeof searchParams.type === "string" ? searchParams.type : null;

  // Verify Stripe purchase if redirected back from checkout
  if (sessionId) {
    if (purchaseType === "bundle") {
      await verifyChairBundlePurchase(sessionId);
    } else if (purchaseType === "template") {
      await verifyChairTemplatePurchase(sessionId);
    } else {
      await verifyChairPlanPurchase(sessionId);
    }
  }

  const { hasAccess, hasTemplate } = await checkChairPlanAccess();
  if (!hasAccess) redirect("/dashboard/guides");

  const justPurchased = !!sessionId;

  return (
    <div className="min-h-screen bg-slate-950 print:bg-white">
      {/* ── App Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-4 print:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/dashboard/guides"
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Low Boy Adirondack Chair
            </h1>
            <p className="text-[11px] text-stone-500">Build Plans</p>
          </div>
          <PrintButton />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4 print:p-0 print:max-w-none">

        {/* ── Purchase success banner ───────────────────────────────── */}
        {justPurchased && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 print:hidden">
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-bold text-emerald-300">
                {purchaseType === "bundle" ? "Bundle purchased — plans unlocked, template on its way!" :
                 purchaseType === "template" ? "Template ordered! We'll ship it to your address." :
                 "Plans unlocked! Welcome to your build guide."}
              </p>
            </div>
          </div>
        )}

        {/* ── Template upsell (plans-only purchasers) ───────────────── */}
        {!hasTemplate && <TemplateUpsell />}

        {/* ── Plans Content ─────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden border border-slate-800 print:border-0">

          {/* Brand header bar */}
          <div className="bg-[#111] px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-[#F5D033] text-xs font-bold uppercase tracking-widest mb-0.5">
                Storage-Network.app Pro Plans
              </p>
              <h2 className="text-white text-xl font-black uppercase leading-tight">
                Low Boy Adirondack Chair
              </h2>
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-stone-500 text-[10px] uppercase tracking-wider">Build time</p>
              <p className="text-[#F5D033] text-sm font-bold">3–4 hours</p>
            </div>
          </div>

          {/* Overview stats */}
          <div className="bg-white grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 border-b border-slate-200">
            {[
              { label: "Skill Level", value: "Beginner" },
              { label: "Materials", value: "~$60–80" },
              { label: "Width × Depth", value: '28" × 38"' },
              { label: "Height", value: '34"' },
            ].map((stat) => (
              <div key={stat.label} className="px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{stat.label}</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* ── Page 1: Tools & Materials + Cut List ─────────────────── */}
          <div className="bg-white p-6 space-y-6 border-b border-slate-200">
            <div className="border-l-[6px] border-[#F5D033] pl-4">
              <h2 className="text-lg font-black uppercase text-[#111]">Tools &amp; Materials</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#111] border-b border-slate-200 pb-2 mb-3">
                  Lumber Requirements
                </h3>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  <li><strong>(5)</strong> 2×6 × 8&apos; Dimensional Lumber</li>
                  <li><strong>(1)</strong> 2×8 × 8&apos; Dimensional Lumber</li>
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#111] border-b border-slate-200 pb-2 mb-3">
                  Hardware &amp; Tools
                </h3>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  <li>2-1/2&quot; Outdoor Pocket Hole Screws (~40)</li>
                  <li>2&quot; &amp; 3&quot; Exterior Deck Screws</li>
                  <li>2&quot; Lag Screws (qty 2)</li>
                  <li>Titebond III Outdoor Wood Glue</li>
                  <li>Kreg Jig, Miter Saw, Jigsaw</li>
                  <li>1/4&quot; Spacer Block, Speed Square, Clamps</li>
                </ul>
              </div>
            </div>

            <div>
              <div className="border-l-[6px] border-[#F5D033] pl-4 mb-4">
                <h2 className="text-lg font-black uppercase text-[#111]">Master Cut List</h2>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#111] text-[#F5D033]">
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Part Name</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Qty</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Lumber</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Dimensions</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "Seat & Back Slats", qty: 6, lumber: "2×6", dims: '23.25" × 5.5"', notes: "Square cuts. Cut all 6 at once." },
                      { name: "Chair Legs", qty: 2, lumber: "2×6", dims: '20.25" × 5.5"', notes: "Angled offset cuts — see profiles below." },
                      { name: "Chair Base (Side Rails)", qty: 2, lumber: "2×8", dims: '38" × 7.5"', notes: "Dual-angled cuts — see profiles below." },
                      { name: "Back Supports", qty: 2, lumber: "2×6", dims: '17.5" × 4.25"', notes: "Rip to 4.25\". Angled rear cut. Cut as mirror pair." },
                      { name: "Arm Rests", qty: 2, lumber: "2×6", dims: '24.25" × 4"', notes: "Rip to 4\". Angled inner taper. Round front end." },
                    ].map((row, i) => (
                      <tr key={row.name} className={i % 2 === 1 ? "bg-slate-50" : "bg-white"}>
                        <td className="px-4 py-3 font-semibold text-slate-800 border-b border-slate-100">{row.name}</td>
                        <td className="px-4 py-3 text-slate-600 border-b border-slate-100">{row.qty}</td>
                        <td className="px-4 py-3 text-slate-600 border-b border-slate-100">{row.lumber}</td>
                        <td className="px-4 py-3 font-mono text-slate-800 border-b border-slate-100">{row.dims}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs border-b border-slate-100">{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Page 2: Point-to-Point Cut Profiles ─────────────────── */}
          <div className="bg-white p-6 space-y-5 border-b border-slate-200">
            <div className="border-l-[6px] border-[#F5D033] pl-4">
              <h2 className="text-lg font-black uppercase text-[#111]">Point-to-Point Cut Profiles</h2>
              <p className="text-xs text-slate-500 mt-0.5">Mark the dots, draw the line, make the cut.</p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#e03e2d]" />
                <span>Cut Line / Reference Point</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#2196F3] border border-slate-300" />
                <span>1&quot; Jigsaw Radius / Pilot Hole</span>
              </div>
            </div>

            {[
              { title: "1. Chair Base (Side Rails)", sub: "Cut 2 from 2×8", svg: <BaseProfileSVG /> },
              { title: "2. Chair Legs", sub: "Cut 2 from 2×6", svg: <LegProfileSVG /> },
              { title: "3. Arm Rests", sub: "Cut 2 from ripped 2×6", svg: <ArmRestProfileSVG /> },
              { title: "4. Back Supports", sub: "Cut 2 from ripped 2×6", svg: <BackSupportProfileSVG /> },
            ].map((profile) => (
              <div key={profile.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-baseline gap-2 border-b border-slate-200 pb-2 mb-4">
                  <p className="text-sm font-black uppercase tracking-wide text-[#111]">{profile.title}</p>
                  <p className="text-xs text-slate-400">{profile.sub}</p>
                </div>
                <div className="overflow-x-auto">
                  {profile.svg}
                </div>
              </div>
            ))}
          </div>

          {/* ── Pages 3–4: Assembly Steps ─────────────────────────────── */}
          <div className="bg-white p-6 space-y-6">
            <div className="border-l-[6px] border-[#F5D033] pl-4">
              <h2 className="text-lg font-black uppercase text-[#111]">Step-by-Step Assembly</h2>
              <p className="text-xs text-slate-500 mt-0.5">Drill all pocket holes before any glue touches the wood.</p>
            </div>

            <AssemblyStep number={1} title="Drill the Pocket Holes" photoKey="step1">
              Set your pocket hole jig for 1.5&quot; material using <Highlight>2-1/2&quot; screws</Highlight>.<br /><br />
              <strong>Back Supports (×2):</strong> Drill 3 pocket holes at the bottom edge. Holes must face the <em>inside</em> of the chair.<br /><br />
              <strong>Slats (×6):</strong> Drill 2 pocket holes on each end of all 6 slats on the &ldquo;ugly&rdquo; face so they stay hidden.
            </AssemblyStep>

            <AssemblyStep number={2} title="Attach Back Support to Base" photoKey="step2">
              Apply Titebond III to the bottom of the Back Support.<br /><br />
              Align it with the Chair Base — the un-angled flat edge of the support faces the <em>front</em>. Drive <Highlight>2-1/2&quot; pocket hole screws</Highlight> through the support into the base.<br /><br />
              Repeat for the opposite side. Both assemblies are mirror images — pocket holes should face each other.
            </AssemblyStep>

            <AssemblyStep number={3} title="Install the Back Slats" photoKey="step3">
              Stand both base/support assemblies upright. Take the 3 back slats.<br /><br />
              Start at the <strong>bottom</strong> and work up. Attach slats spanning across both supports using <Highlight>2-1/2&quot; screws</Highlight>.<br /><br />
              Place a <Highlight>1/4&quot; spacer block</Highlight> between each slat as you move up — this ensures even drainage gaps.
            </AssemblyStep>

            <AssemblyStep number={4} title="Install the Seat Slats" photoKey="step4">
              Carefully <strong>flip the chair upside down</strong>.<br /><br />
              Apply adhesive and attach the remaining 3 slats to the base using <Highlight>2-1/2&quot; screws</Highlight>. Use your <Highlight>1/4&quot; spacer block</Highlight> between each slat.<br /><br />
              Start at the rear (closest to back slats) and work toward the front. Front slat should sit flush with the front edge of the base.
            </AssemblyStep>

            <AssemblyStep number={5} title="Attach the Legs" photoKey="step5">
              Flip the chair right-side up. Lean it backward so it rests naturally on the angled rear cut of the base. Prop and clamp to hold this angle while you work.<br /><br />
              Apply adhesive, then drive <Highlight>2&quot; deck screws</Highlight> through the face of each leg into the base. Add one <Highlight>3&quot; deck screw</Highlight> from above through the base into the top of the leg.
            </AssemblyStep>

            <AssemblyStep number={6} title="Finish with Arm Rests" photoKey="step6">
              Place armrests on top of the front legs and rear back supports, leaving a <strong>2&quot; overhang</strong> on the front.<br /><br />
              Secure the <strong>rear</strong> to the back support using adhesive and a <Highlight>2&quot; lag screw</Highlight>.<br /><br />
              Drive <Highlight>3 deck screws</Highlight> through the pre-drilled countersunk holes at the front into the leg. Keep all holes <strong>3/4&quot; from the side edge</strong>.
            </AssemblyStep>

            {/* Installer notes */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mt-2">
              <p className="text-xs font-black uppercase tracking-wider text-amber-800 mb-2">Installer Notes</p>
              <ul className="space-y-1.5 text-sm text-amber-900">
                <li>• <strong>Shop build time:</strong> ~2.5 hrs per unit</li>
                <li>• <strong>On-site build time:</strong> ~3.5 hrs (add setup/cleanup)</li>
                <li>• <strong>Quote as a pair</strong> — a single chair rarely sells when a pair is on display</li>
                <li>• <strong>Upsell:</strong> Matching side table (1× 2×8×8 + 1× 2×6×8)</li>
                <li>• <strong>Add-on trigger:</strong> Offer chairs once a garage storage unit is booked — &ldquo;Complete your outdoor space&rdquo;</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-[#111] px-6 py-3 flex items-center justify-between">
            <p className="text-stone-500 text-xs">Storage-Network.app Pro Plans</p>
            <p className="text-stone-500 text-xs">Low Boy Adirondack Chair</p>
          </div>
        </div>
      </main>
    </div>
  );
}
