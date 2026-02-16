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
import { validateServiceArea, submitWaitlistRequest } from "@/app/actions/installer";
import type { InstallerPricing } from "@/types/viewModels";
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

function BookingPageInner() {
  const params = useParams();
  const installerId = params.installerId as string;

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
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b-4 border-yellow-400 bg-gray-950 px-4 py-3">
        <div className="mx-auto max-w-lg text-center">
          <Image
            src="/logo-storage-network.png"
            alt="Storage Network"
            width={56}
            height={56}
            className="mx-auto mb-1 h-14 w-auto object-contain"
          />
          <h1 className="text-sm font-extrabold uppercase tracking-widest text-white">
            Custom Storage Configurator
          </h1>
          <p className="text-[10px] uppercase tracking-wider text-yellow-400">
            Design &amp; Book Your Build
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
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
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-800 px-4 py-6 text-center">
        <Image src="/logo-storage-network.png" alt="Storage Network" width={40} height={40} className="mx-auto mb-2 h-10 w-auto object-contain" />
        <p className="text-[10px] text-stone-700">
          Powered by The Storage-Network Partner Program
        </p>
      </footer>
    </div>
  );
}
