"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  calculateShelfMaterials,
  getMaxFit,
  type CalculationResult,
} from "@/app/actions/calculate";
import {
  ClipboardList,
  Calculator,
  Lock,
  Loader2,
  LogOut,
  ChevronRight,
  Ruler,
  ShoppingCart,
  DollarSign,
  Layers,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Profile {
  id: string;
  email: string;
  business_name: string | null;
  is_pro: boolean;
}

interface Lead {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  address: string | null;
  status: string;
  source: string;
  created_at: string;
}

type Tab = "leads" | "calculator";

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const supabase = getSupabaseBrowserClient();

  // -- State ----------------------------------------------------------------
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("leads");
  const [loading, setLoading] = useState(true);

  // Calculator state
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [toteType, setToteType] = useState<"hdx" | "greenmade">("hdx");
  const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
  const [calcError, setCalcError] = useState("");
  const [calculating, setCalculating] = useState(false);

  // -- Data fetching --------------------------------------------------------

  const fetchProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) setProfile(data as Profile);
  }, [supabase]);

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setLeads(data as Lead[]);
  }, [supabase]);

  useEffect(() => {
    Promise.all([fetchProfile(), fetchLeads()]).finally(() =>
      setLoading(false)
    );
  }, [fetchProfile, fetchLeads]);

  // -- Handlers -------------------------------------------------------------

  async function handleCalculate() {
    setCalcError("");
    setCalcResult(null);

    const w = parseFloat(width);
    const h = parseFloat(height);

    if (!w || !h) {
      setCalcError("Enter valid width and height values.");
      return;
    }

    setCalculating(true);
    try {
      const fit = await getMaxFit(w, h, toteType);
      const result = await calculateShelfMaterials(
        fit.maxCols,
        fit.maxRows,
        toteType
      );
      setCalcResult(result);
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : "Calculation failed.");
    } finally {
      setCalculating(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  // -- Render helpers -------------------------------------------------------

  const statusColor: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    contacted: "bg-amber-100 text-amber-700",
    quoted: "bg-purple-100 text-purple-700",
    accepted: "bg-emerald-100 text-emerald-700",
    completed: "bg-slate-100 text-slate-700",
    cancelled: "bg-red-100 text-red-700",
  };

  // -- Loading state --------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // -- Main render ----------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">
              The Shelf Dude
            </h1>
            {profile && (
              <p className="text-xs text-slate-400">
                {profile.business_name ?? profile.email}
                {profile.is_pro && (
                  <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    PRO
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── Tab Bar ────────────────────────────────────────────────────── */}
      <nav className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-3xl">
          <button
            onClick={() => setActiveTab("leads")}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "leads"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            My Leads
          </button>
          <a
            href="/dashboard/calculator"
            className="flex flex-1 items-center justify-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-slate-400 transition-colors hover:text-white"
          >
            <Calculator className="h-4 w-4" />
            Calculator
          </a>
        </div>
      </nav>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl p-4">
        {activeTab === "leads" ? (
          <LeadsTab leads={leads} statusColor={statusColor} />
        ) : (
          <CalculatorTab
            width={width}
            height={height}
            toteType={toteType}
            setWidth={setWidth}
            setHeight={setHeight}
            setToteType={setToteType}
            onCalculate={handleCalculate}
            calculating={calculating}
            calcResult={calcResult}
            calcError={calcError}
            isPro={profile?.is_pro ?? false}
          />
        )}
      </main>
    </div>
  );
}

// ===========================================================================
// Leads Tab
// ===========================================================================

function LeadsTab({
  leads,
  statusColor,
}: {
  leads: Lead[];
  statusColor: Record<string, string>;
}) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
        <ClipboardList className="mb-3 h-10 w-10" />
        <p className="font-medium text-slate-600">No leads yet</p>
        <p className="mt-1 text-sm">
          Network leads from The Shelf Dude will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {leads.map((lead) => (
        <a
          href={`/dashboard/leads/${lead.id}`}
          key={lead.id}
          className="card-float-light block p-4 transition-shadow hover:shadow-2xl"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">
                {lead.customer_name}
              </p>
              {lead.address && (
                <p className="mt-0.5 truncate text-sm text-slate-500">
                  {lead.address}
                </p>
              )}
            </div>
            <span
              className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                statusColor[lead.status] ?? "bg-slate-100 text-slate-700"
              }`}
            >
              {lead.status}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>
              {lead.source === "network" ? "Network Lead" : "Self-Generated"}
            </span>
            <div className="flex items-center gap-1">
              {new Date(lead.created_at).toLocaleDateString()}
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        </a>
      ))}
    </ul>
  );
}

// ===========================================================================
// Calculator Tab
// ===========================================================================

function CalculatorTab({
  width,
  height,
  toteType,
  setWidth,
  setHeight,
  setToteType,
  onCalculate,
  calculating,
  calcResult,
  calcError,
  isPro,
}: {
  width: string;
  height: string;
  toteType: "hdx" | "greenmade";
  setWidth: (v: string) => void;
  setHeight: (v: string) => void;
  setToteType: (v: "hdx" | "greenmade") => void;
  onCalculate: () => void;
  calculating: boolean;
  calcResult: CalculationResult | null;
  calcError: string;
  isPro: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* ── Input Card ───────────────────────────────────────────────── */}
      <div className="card-float-light p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          Wall Dimensions
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Width (inches)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="e.g. 120"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Height (inches)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="e.g. 96"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Tote Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["hdx", "greenmade"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setToteType(t)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  toteType === t
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t === "hdx" ? 'HDX (19.75")' : 'Greenmade (20.75")'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onCalculate}
          disabled={calculating}
          className="btn-brand mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white"
        >
          {calculating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Calculator className="h-4 w-4" />
          )}
          {calculating ? "Calculating…" : "Calculate Build"}
        </button>

        {calcError && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {calcError}
          </p>
        )}
      </div>

      {/* ── Results ──────────────────────────────────────────────────── */}
      {calcResult && (
        <>
          {/* Specs Card */}
          <div className="card-float-light p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Ruler className="h-4 w-4 text-indigo-600" />
              Specs
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Columns" value={calcResult.specs.cols} />
              <Stat label="Rows" value={calcResult.specs.rows} />
              <Stat
                label="Built Width"
                value={`${calcResult.specs.total_width}"`}
              />
              <Stat
                label="Built Height"
                value={`${calcResult.specs.total_height}"`}
              />
            </div>
          </div>

          {/* Price Card */}
          <div className="card-float-light p-4">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              Estimated Price
            </h3>
            <p className="text-5xl font-extrabold tracking-tight text-emerald-500">
              ${calcResult.grand_total.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {calcResult.specs.rows * calcResult.specs.cols} slots × $40 each
            </p>
          </div>

          {/* Cut List Card — gated behind Pro */}
          <div className="card-float-light relative overflow-hidden p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Layers className="h-4 w-4 text-orange-500" />
              Cut List
            </h3>

            {isPro ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-400">
                    <th className="pb-2 font-medium">Part</th>
                    <th className="pb-2 font-medium">Length</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calcResult.cut_list.map((item, i) => (
                    <tr key={i}>
                      <td className="py-2 text-slate-700">{item.part_name}</td>
                      <td className="py-2 text-slate-500">{item.length}&quot;</td>
                      <td className="py-2 text-right font-medium text-slate-900">
                        {item.qty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              /* Ghost data: show first 2 rows at 50% opacity, blur the numbers */
              <table className="w-full select-none text-left text-sm opacity-50">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-400">
                    <th className="pb-2 font-medium">Part</th>
                    <th className="pb-2 font-medium">Length</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calcResult.cut_list.slice(0, 2).map((item, i) => (
                    <tr key={i}>
                      <td className="py-2 text-slate-700">{item.part_name}</td>
                      <td className="py-2 text-slate-500 blur-[5px]">{item.length}&quot;</td>
                      <td className="py-2 text-right font-medium text-slate-900 blur-[5px]">
                        {item.qty}
                      </td>
                    </tr>
                  ))}
                  {/* Faded placeholder rows */}
                  <tr className="opacity-30">
                    <td className="py-2 text-slate-400">────────</td>
                    <td className="py-2 text-slate-400">──</td>
                    <td className="py-2 text-right text-slate-400">──</td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* Shopping List — also gated */}
            <h3 className="mb-3 mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ShoppingCart className="h-4 w-4 text-indigo-500" />
              Shopping List
            </h3>

            {isPro ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-400">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calcResult.shopping_list.map((item, i) => (
                    <tr key={i}>
                      <td className="py-2 text-slate-700">{item.sku_name}</td>
                      <td className="py-2 text-right font-medium text-slate-900">
                        {item.qty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full select-none text-left text-sm opacity-50">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-400">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calcResult.shopping_list.slice(0, 2).map((item, i) => (
                    <tr key={i}>
                      <td className="py-2 text-slate-700">{item.sku_name}</td>
                      <td className="py-2 text-right font-medium text-slate-900 blur-[5px]">
                        {item.qty}
                      </td>
                    </tr>
                  ))}
                  <tr className="opacity-30">
                    <td className="py-2 text-slate-400">────────</td>
                    <td className="py-2 text-right text-slate-400">──</td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* Pro Gate Overlay */}
            {!isPro && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-t from-white via-white/90 to-white/60">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                  <Lock className="h-7 w-7 text-amber-600" />
                </div>
                <p className="mb-1 text-base font-bold text-slate-800">
                  Pro Feature
                </p>
                <p className="mb-4 max-w-[260px] text-center text-xs leading-relaxed text-slate-500">
                  Unlock precise cut lists, shopping lists, and save unlimited
                  builds for <span className="font-semibold text-slate-700">$49/mo</span>.
                </p>
                <a
                  href={`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/upgrade`}
                  className="rounded-lg px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-amber-400/30"
                  style={{
                    background:
                      "linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)",
                  }}
                >
                  Upgrade to Pro
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ===========================================================================
// Tiny stat helper
// ===========================================================================

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
