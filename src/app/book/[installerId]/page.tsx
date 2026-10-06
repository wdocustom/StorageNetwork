"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { calculateBuild } from "@/app/actions/calculator";
import { getInstallerPricing } from "@/app/actions/pricing";
import { submitNetworkLead } from "@/app/actions/submit-lead";
import { getRepeatOrderContext, type RepeatOrderContext, type RepeatOrderUnit } from "@/app/actions/repeat-order-context";
import { validateServiceArea, submitWaitlistRequest } from "@/app/actions/installer";
import type { InstallerPricing } from "@/types/viewModels";
import PageViewTracker from "@/components/tracking/PageViewTracker";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Send,
  X,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Types (display-only — no pricing constants)
// ═══════════════════════════════════════════════════════════════════════════
type ToteType = "HDX" | "GM";

interface UnitConfig {
  cols: number;
  rows: number;
  toteType: ToteType;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price: number;
  totalW: number;
  totalH: number;
  desc: string;
}

interface ServerBuild {
  cols: number;
  rows: number;
  price: number;
  totalW: number;
  totalH: number;
  slots: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public Booking Page — Installer's Self-Lead Configurator
// ═══════════════════════════════════════════════════════════════════════════

export default function BookingPage() {
  return (
    <Suspense>
      <BookingPageInner />
    </Suspense>
  );
}

// ── Realtor-referral attribution helpers ─────────────────────────────────
// The realtor's `/refer/<code>` landing route drops `sn_realtor_ref`; we
// also accept `?ref=<code>` on the booking URL for direct shares. Query
// param wins so a freshly-shared link overrides a stale cookie.
const REFERRAL_COOKIE = "sn_realtor_ref";

function readRealtorReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const qp = new URLSearchParams(window.location.search).get("ref");
  if (qp && qp.trim().length >= 4) return qp.trim().toUpperCase();

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${REFERRAL_COOKIE}=([^;]+)`)
  );
  if (match && match[1]) {
    const decoded = decodeURIComponent(match[1]).trim().toUpperCase();
    if (decoded.length >= 4) return decoded;
  }
  return null;
}

// ── Platform marketing-email attribution ─────────────────────────────────
// Campaign emails link here with `?mc=<token>`. Remember it for 30 days so a
// customer who browses away and comes back still books under the campaign.
// The token is only a claim — the server validates it (installer match +
// attribution window) before applying the network fee.
const MARKETING_COOKIE = "sn_mc";

function readMarketingToken(installerId: string): string | null {
  if (typeof window === "undefined") return null;
  const qp = new URLSearchParams(window.location.search).get("mc");
  if (qp && qp.trim()) {
    try {
      document.cookie = `${MARKETING_COOKIE}=${encodeURIComponent(
        `${installerId}:${qp.trim()}`
      )}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`;
    } catch {}
    return qp.trim();
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${MARKETING_COOKIE}=([^;]+)`));
  if (match && match[1]) {
    const [cookieInstaller, token] = decodeURIComponent(match[1]).split(":");
    if (cookieInstaller === installerId && token) return token;
  }
  return null;
}

function BookingPageInner() {
  const params = useParams();
  const installerId = params.installerId as string;

  // ── Repeat-order context (arrived from a campaign email) ──────────────
  // A valid ?mc= token unlocks the customer's details + last order, priced at
  // this installer's current rates. Without one, the page is unchanged.
  const [repeat, setRepeat] = useState<RepeatOrderContext | null>(null);
  const [addedCounts, setAddedCounts] = useState<Record<string, number>>({});

  // Capture a campaign-email token on arrival so it survives in-page navigation.
  useEffect(() => {
    const token = readMarketingToken(installerId);
    if (!token) return;
    getRepeatOrderContext(token, installerId)
      .then((res) => {
        if (!res.success) return;
        setRepeat(res.context);
        // Prefill only what we have, and never overwrite what the customer typed.
        const c = res.context.customer;
        setName((v) => v || c.name);
        setEmail((v) => v || c.email);
        setPhone((v) => v || c.phone);
        setAddress((v) => v || c.address);
        setAddressZip((v) => v || c.zip);
      })
      .catch(() => {});
  }, [installerId]);

  // ── Design inputs ─────────────────────────────────────────────────────
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(4);
  const [toteType, setToteType] = useState<ToteType>("HDX");
  const [hasTotes, setHasTotes] = useState(true);
  const [hasWheels, setHasWheels] = useState(true);
  const [hasTop, setHasTop] = useState(false);

  // ── Server build result ───────────────────────────────────────────────
  const [build, setBuild] = useState<ServerBuild>({
    cols: 4, rows: 4, price: 0, totalW: 0, totalH: 0, slots: 0,
  });
  const [buildLoading, setBuildLoading] = useState(false);

  // ── Multi-unit quote list ─────────────────────────────────────────────
  const [orderItems, setOrderItems] = useState<UnitConfig[]>([]);

  // ── Booking form ──────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [zipOutOfArea, setZipOutOfArea] = useState(false);
  const [zipCheckMsg, setZipCheckMsg] = useState("");
  const [waitlistSending, setWaitlistSending] = useState(false);
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Installer pricing (Pro feature) ──────────────────────────────────
  const [installerPricing, setInstallerPricing] = useState<InstallerPricing | undefined>();

  useEffect(() => {
    if (!installerId) return;
    getInstallerPricing(installerId).then((res) => {
      if (res.success && res.pricing) setInstallerPricing(res.pricing);
    });
  }, [installerId]);

  const grandTotal = orderItems.reduce((sum, it) => sum + it.price, 0);

  // ── Debounced server call ─────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBuild = useCallback(
    (c: number, r: number, model: ToteType, totes: boolean, wheels: boolean, top: boolean) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setBuildLoading(true);
        try {
          const res = await calculateBuild({
            cols: c, rows: r, toteModel: model,
            addOns: { totes, wheels, top }, mode: "manual",
            installerPricing,
          });
          if (res.success) {
            setBuild({
              cols: res.cols, rows: res.rows, price: res.price,
              totalW: res.dimensions.totalW, totalH: res.dimensions.totalH,
              slots: res.config.slots,
            });
          }
        } catch { /* keep previous */ }
        finally { setBuildLoading(false); }
      }, 500);
    }, [installerPricing]
  );

  useEffect(() => {
    fetchBuild(cols, rows, toteType, hasTotes, hasWheels, hasTop);
  }, [cols, rows, toteType, hasTotes, hasWheels, hasTop, fetchBuild]);

  // ── Real-time ZIP service-area check ────────────────────────────────
  const zipCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (zipCheckRef.current) clearTimeout(zipCheckRef.current);

    const zip = addressZip.trim();
    if (!zip || zip.length < 5) {
      setZipOutOfArea(false);
      setZipCheckMsg("");
      return;
    }

    zipCheckRef.current = setTimeout(async () => {
      try {
        const result = await validateServiceArea(installerId, zip);
        if (!result.inArea) {
          setZipOutOfArea(true);
          setZipCheckMsg(
            result.radiusMiles
              ? `ZIP ${zip} is outside this installer's ${result.radiusMiles}-mile service area.`
              : `ZIP ${zip} is outside this installer's service area.`
          );
        } else {
          setZipOutOfArea(false);
          setZipCheckMsg("");
        }
      } catch {
        setZipOutOfArea(false);
        setZipCheckMsg("");
      }
    }, 600);

    return () => {
      if (zipCheckRef.current) clearTimeout(zipCheckRef.current);
    };
  }, [addressZip, installerId]);

  // ── Handlers ──────────────────────────────────────────────────────────

  function handleAddUnit() {
    setOrderItems((prev) => [
      ...prev,
      {
        cols: build.cols, rows: build.rows, toteType,
        hasTotes, hasWheels, hasTop, price: build.price,
        totalW: build.totalW, totalH: build.totalH,
        desc: `${build.cols} Wide × ${build.rows} High`,
      },
    ]);
  }

  function pastUnitToConfig(u: RepeatOrderUnit): UnitConfig {
    return {
      cols: u.cols, rows: u.rows, toteType: u.toteType,
      hasTotes: u.hasTotes, hasWheels: u.hasWheels, hasTop: u.hasTop,
      price: u.price, totalW: u.totalW, totalH: u.totalH,
      desc: `${u.cols} Wide × ${u.rows} High`,
    };
  }

  function handleAddPastUnit(u: RepeatOrderUnit, count = 1) {
    if (!u.available) return;
    setOrderItems((prev) => [...prev, ...Array.from({ length: count }, () => pastUnitToConfig(u))]);
    setAddedCounts((prev) => ({ ...prev, [u.key]: (prev[u.key] ?? 0) + count }));
  }

  function handleAddWholePastOrder() {
    for (const u of repeat?.units ?? []) {
      if (u.available) handleAddPastUnit(u, u.quantity);
    }
  }

  function handleRemoveUnit(index: number) {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleBookDeposit() {
    setSubmitError("");
    if (!name.trim() || !email.trim()) {
      setSubmitError("Name and email are required.");
      return;
    }
    if (orderItems.length === 0) {
      setSubmitError("Add at least one unit to your quote.");
      return;
    }
    if (zipOutOfArea) {
      setSubmitError("This installer does not service your ZIP code. Please verify your installation address.");
      return;
    }

    setSubmitting(true);
    try {
      const realtorReferralCode = readRealtorReferralCode();
      const marketingToken = readMarketingToken(installerId);
      await submitNetworkLead({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        address,
        address_zip: addressZip || undefined,
        quote_data: orderItems,
        grand_total: grandTotal,
        // ─── SELF-LEAD: inject installer_id + source ───────────────
        installer_id: installerId,
        realtor_referral_code: realtorReferralCode || undefined,
        marketing_token: marketingToken || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWaitlist() {
    setWaitlistError("");
    if (!name.trim() || !email.trim()) {
      setWaitlistError("Name and email are required to join the waitlist.");
      return;
    }
    setWaitlistSending(true);
    try {
      const res = await submitWaitlistRequest({
        installer_id: installerId,
        customer_name: name,
        customer_email: email,
        customer_phone: phone || undefined,
        customer_zip: addressZip,
      });
      if (res.success) {
        setWaitlistSent(true);
      } else {
        setWaitlistError(res.error || "Something went wrong.");
      }
    } catch {
      setWaitlistError("Something went wrong. Please try again.");
    } finally {
      setWaitlistSending(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ── Analytics: track page view for installer ────────────────── */}
      {installerId && <PageViewTracker installerId={installerId} page="/book" />}

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b-4 border-yellow-400 bg-gray-950 px-4 py-3">
        <div className="mx-auto max-w-lg text-center">
          {repeat?.installer.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={repeat.installer.avatarUrl}
              alt={repeat.installer.name}
              className="mx-auto mb-1 h-14 w-14 rounded-full border border-yellow-400/60 object-cover"
            />
          ) : (
            <Image
              src="/Header_avatar_logo.png"
              alt="Storage Network"
              width={56}
              height={56}
              className="mx-auto mb-1 h-14 w-auto object-contain"
            />
          )}
          <h1 className="text-sm font-extrabold uppercase tracking-widest text-white">
            {repeat ? repeat.installer.name : "Custom Storage Configurator"}
          </h1>
          <p className="text-[10px] uppercase tracking-wider text-yellow-400">
            {repeat
              ? `Order another rack${repeat.installer.location ? ` · ${repeat.installer.location}` : ""}`
              : "Design & Book Your Build"}
          </p>
        </div>
      </header>

      <main
        className={
          repeat && repeat.units.length > 0
            ? "mx-auto max-w-lg space-y-4 p-4 lg:grid lg:max-w-4xl lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-4 lg:space-y-0"
            : "mx-auto max-w-lg space-y-4 p-4"
        }
      >
        {/* ── Previous order (repeat customers) ───────────────────────── */}
        {repeat && repeat.units.length > 0 && (
          <aside className="rounded-xl border border-yellow-400/40 bg-gray-900 p-4 lg:col-start-2 lg:row-start-1 lg:self-start">
            <h2 className="text-xs font-bold uppercase tracking-wider text-yellow-400">
              Your previous order
            </h2>
            <p className="mb-3 mt-1 text-[11px] text-stone-500">
              Tap a rack to add it to your quote at {repeat.installer.name}&rsquo;s current pricing.
            </p>
            <ul className="space-y-2">
              {repeat.units.map((u) => {
                const extras: string[] = [];
                if (u.hasTotes) extras.push("Totes");
                if (u.hasWheels) extras.push("Wheels");
                if (u.hasTop) extras.push("Top");
                const added = addedCounts[u.key] ?? 0;
                return (
                  <li key={u.key}>
                    {u.available ? (
                      <button
                        onClick={() => handleAddPastUnit(u)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-stone-700 bg-slate-800 px-3 py-2.5 text-left transition-colors hover:border-yellow-400"
                      >
                        <span>
                          <span className="block text-sm font-semibold text-white">
                            {u.cols} Wide × {u.rows} High
                            {u.quantity > 1 && (
                              <span className="ml-1 text-[11px] font-normal text-stone-500">
                                (ordered ×{u.quantity})
                              </span>
                            )}
                          </span>
                          <span className="block text-[11px] text-stone-500">
                            {extras.length > 0 ? extras.join(", ") : "Frame Only"}
                          </span>
                          {added > 0 && (
                            <span className="text-[11px] font-bold text-emerald-400">
                              {added} in your quote
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-bold text-yellow-400">
                            ${u.price.toLocaleString()}
                          </span>
                          <Plus className="h-4 w-4 text-yellow-400" />
                        </span>
                      </button>
                    ) : (
                      <div className="rounded-lg border border-stone-800 bg-slate-900 px-3 py-2.5 text-[11px] text-stone-500">
                        {u.unavailableLabel || "Not available online"}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {repeat.units.filter((u) => u.available).length > 0 && (
              <button
                onClick={handleAddWholePastOrder}
                className="mt-3 w-full rounded-lg bg-yellow-400 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
              >
                Add entire previous order
              </button>
            )}
          </aside>
        )}

        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
        {/* ── Configuration Card ──────────────────────────────────── */}
        <section className="rounded-xl border border-stone-800 bg-gray-900 p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">
            Configure Your Unit
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-stone-500">
                Columns
              </label>
              <input
                type="number"
                min={1} max={12} value={cols}
                onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-lg border border-stone-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-stone-500">
                Tiers High
              </label>
              <input
                type="number"
                min={1} max={10} value={rows}
                onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-lg border border-stone-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-stone-500">
              Tote Model
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["HDX", "GM"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setToteType(t)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    toteType === t
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                      : "border-stone-700 text-stone-400"
                  }`}
                >
                  {t === "HDX" ? 'HDX (19.75")' : 'Greenmade (20.75")'}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="mt-3 space-y-2">
            {[
              { val: hasTotes, set: setHasTotes, label: "Include Totes" },
              { val: hasWheels, set: setHasWheels, label: "Add Wheels" },
              { val: hasTop, set: setHasTop, label: "Plywood Top" },
            ].map(({ val, set, label }) => (
              <label key={label} className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => set(e.target.checked)}
                  className="h-4 w-4 accent-yellow-400"
                />
                <span className="text-sm text-stone-300">{label}</span>
              </label>
            ))}
          </div>

          {/* Price + Add */}
          <div className="mt-4 flex items-center gap-3 border-t border-stone-800 pt-4">
            <div className="flex-1 text-center">
              <div className="text-2xl font-black text-white">
                {buildLoading ? "…" : `$${build.price.toLocaleString()}`}
              </div>
              <div className="text-[10px] font-bold uppercase text-stone-500">
                Per Unit
              </div>
            </div>
            <button
              onClick={handleAddUnit}
              disabled={buildLoading || build.price === 0}
              className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Add to Quote
            </button>
          </div>
        </section>

        {/* ── Quote List ─────────────────────────────────────────────── */}
        {orderItems.length > 0 && (
          <section className="rounded-xl border border-stone-800 bg-gray-900 p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">
              Your Quote
            </h2>
            <ul className="space-y-2">
              {orderItems.map((item, index) => {
                const extras: string[] = [];
                if (item.hasTotes) extras.push("Totes");
                if (item.hasWheels) extras.push("Wheels");
                if (item.hasTop) extras.push("Top");
                return (
                  <li
                    key={index}
                    className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Unit #{index + 1}: {item.desc}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        {extras.length > 0 ? extras.join(", ") : "Frame Only"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-yellow-400">
                        ${item.price.toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleRemoveUnit(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Grand Total */}
            <div className="mt-4 border-t border-dashed border-stone-700 pt-4 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Estimated Total
              </div>
              <div className="mt-1 text-4xl font-black text-white">
                ${grandTotal.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-stone-500">
                15% deposit due at booking
              </div>
            </div>

            {/* Booking Form */}
            <div className="mt-4 border-t border-stone-800 pt-4">
              {!submitted ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name *"
                      className="w-full rounded-lg border border-stone-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-yellow-400 focus:outline-none"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email *"
                      className="w-full rounded-lg border border-stone-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone"
                    className="w-full rounded-lg border border-stone-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-yellow-400 focus:outline-none"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Installation address"
                      className="col-span-2 w-full rounded-lg border border-stone-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-yellow-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={addressZip}
                      onChange={(e) => setAddressZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      placeholder="ZIP *"
                      className={`w-full rounded-lg border px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none ${
                        zipOutOfArea
                          ? "border-red-500 bg-red-950/30 focus:border-red-400"
                          : "border-stone-700 bg-slate-800 focus:border-yellow-400"
                      }`}
                    />
                  </div>
                  {zipOutOfArea && zipCheckMsg && !waitlistSent && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
                      <div className="mb-2 flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                        <p className="text-xs leading-relaxed text-amber-300">{zipCheckMsg}</p>
                      </div>
                      <p className="mb-3 text-xs text-stone-400">
                        Want this installer to know you&rsquo;re interested? Join the waitlist and they&rsquo;ll be notified.
                      </p>
                      <button
                        onClick={handleWaitlist}
                        disabled={waitlistSending}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 py-2.5 text-sm font-bold text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        {waitlistSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                        {waitlistSending ? "Sending…" : "Join Waitlist"}
                      </button>
                      {waitlistError && (
                        <p className="mt-2 text-xs font-medium text-red-400">{waitlistError}</p>
                      )}
                    </div>
                  )}
                  {waitlistSent && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 text-center">
                      <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
                      <p className="text-sm font-semibold text-white">Waitlist Request Sent</p>
                      <p className="mt-1 text-xs text-stone-400">
                        The installer has been notified. They&rsquo;ll reach out if they can accommodate your area.
                      </p>
                    </div>
                  )}
                  {!zipOutOfArea && (
                    <button
                      onClick={handleBookDeposit}
                      disabled={submitting}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {submitting ? "Submitting…" : "Book & Pay Deposit"}
                    </button>
                  )}
                  {submitError && (
                    <p className="text-xs font-medium text-red-400">{submitError}</p>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
                  <p className="text-lg font-bold text-white">Booking Received!</p>
                  <p className="mt-1 text-sm text-stone-400">
                    Your installer will reach out within 24 hours.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-800 px-4 py-6 text-center">
        <Image src="/Header_avatar_logo.png" alt="Storage Network" width={40} height={40} className="mx-auto mb-2 h-10 w-auto object-contain" />
        <p className="text-[10px] text-stone-700">
          Powered by The Storage-Network Partner Program
        </p>
      </footer>
    </div>
  );
}
