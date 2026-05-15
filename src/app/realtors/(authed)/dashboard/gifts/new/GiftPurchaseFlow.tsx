"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  MapPin,
  Package as PackageIcon,
  ShieldCheck,
} from "lucide-react";

import {
  createGiftCheckout,
  type ToteRentalPackage,
} from "@/app/actions/realtor-gifts";
import { previewToteGiftDelivery } from "@/app/actions/realtor-tote-delivery";

// ═══════════════════════════════════════════════════════════════════════════
// GiftPurchaseFlow — client component
//
// Two-step UI:
//   1. Package selection + duration tab
//   2. Recipient details form
// Submit → createGiftCheckout → window.location to Stripe.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  packages: ToteRentalPackage[];
}

export function GiftPurchaseFlow({ packages }: Props) {
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    packages[1]?.id ?? packages[0]?.id ?? null
  );

  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === selectedPackageId) || null,
    [packages, selectedPackageId]
  );

  const [durationDays, setDurationDays] = useState<number>(
    selectedPackage?.pricing_tiers[1]?.duration_days ??
      selectedPackage?.pricing_tiers[0]?.duration_days ??
      14
  );

  const selectedTier = useMemo(() => {
    if (!selectedPackage) return null;
    return (
      selectedPackage.pricing_tiers.find((t) => t.duration_days === durationDays) ||
      selectedPackage.pricing_tiers[0] ||
      null
    );
  }, [selectedPackage, durationDays]);

  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyZip, setPropertyZip] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Coverage gate ────────────────────────────────────────────────────
  // Quick-send refuses ZIPs where no tote-fulfillment installer covers the
  // area. Debounced fetch on every 5-digit ZIP so the realtor sees the
  // verdict before they get to the Pay button.
  type CoverageStatus = "idle" | "checking" | "covered" | "no_coverage";
  const [coverageStatus, setCoverageStatus] = useState<CoverageStatus>("idle");
  const [coverageMessage, setCoverageMessage] = useState<string | null>(null);

  useEffect(() => {
    const zipTrimmed = propertyZip.trim();
    if (!/^\d{5}$/.test(zipTrimmed)) {
      setCoverageStatus("idle");
      setCoverageMessage(null);
      return;
    }

    let cancelled = false;
    setCoverageStatus("checking");
    setCoverageMessage(null);

    const handle = window.setTimeout(async () => {
      try {
        const preview = await previewToteGiftDelivery({ deliveryZip: zipTrimmed });
        if (cancelled) return;
        if (preview.tier === "no_coverage") {
          setCoverageStatus("no_coverage");
          setCoverageMessage(preview.message);
        } else {
          setCoverageStatus("covered");
          setCoverageMessage(null);
        }
      } catch {
        if (cancelled) return;
        // Network hiccup — treat as unknown rather than blocking; the server
        // action will re-check on submit and reject if it's truly uncovered.
        setCoverageStatus("idle");
        setCoverageMessage(null);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [propertyZip]);

  function selectPackage(id: string) {
    setSelectedPackageId(id);
    const pkg = packages.find((p) => p.id === id);
    // Snap to the closest available duration in the new package's tiers.
    if (pkg && !pkg.pricing_tiers.some((t) => t.duration_days === durationDays)) {
      setDurationDays(pkg.pricing_tiers[0]?.duration_days ?? 14);
    }
  }

  async function handleSubmit() {
    setError("");
    if (!selectedPackage || !selectedTier) {
      setError("Pick a package first.");
      return;
    }
    if (!recipientName.trim() || !recipientEmail.trim()) {
      setError("Recipient name and email are required.");
      return;
    }
    if (!/^\d{5}$/.test(propertyZip.trim())) {
      setError("A 5-digit property ZIP is required so we can confirm delivery coverage.");
      return;
    }
    if (coverageStatus === "no_coverage") {
      setError(coverageMessage ?? "We don't have an installer covering that ZIP yet.");
      return;
    }

    setLoading(true);
    const result = await createGiftCheckout({
      packageId: selectedPackage.id,
      durationDays: selectedTier.duration_days,
      recipientName: recipientName.trim(),
      recipientEmail: recipientEmail.trim(),
      recipientPhone: recipientPhone.trim() || undefined,
      propertyAddress: propertyAddress.trim() || undefined,
      propertyZip: propertyZip.trim() || undefined,
      personalMessage: personalMessage.trim() || undefined,
    });

    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error || "Couldn't start checkout. Please try again.");
      setLoading(false);
    }
  }

  if (packages.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
        <p className="text-stone-300">
          No packages are available right now. Check back shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      {/* ── Left: package picker + recipient form ──────────────────── */}
      <div className="space-y-10">
        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
            1. Package
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {packages.map((pkg) => {
              const cheapest = pkg.pricing_tiers.reduce(
                (lo, t) => (t.price_cents < lo ? t.price_cents : lo),
                Infinity
              );
              const isSelected = selectedPackageId === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => selectPackage(pkg.id)}
                  className={`group relative flex flex-col rounded-2xl border p-5 text-left transition-all ${
                    isSelected
                      ? "border-yellow-400/60 bg-yellow-400/5"
                      : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                  }`}
                >
                  {isSelected && (
                    <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-slate-950">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                  <div className="mb-2 flex items-center gap-2">
                    <PackageIcon className={`h-4 w-4 ${isSelected ? "text-yellow-400" : "text-stone-500"}`} />
                    <p className="text-base font-bold">{pkg.name}</p>
                  </div>
                  <p className="mb-3 text-xs text-stone-400">{pkg.best_for}</p>
                  <p className="mb-3 text-sm text-stone-300">
                    <strong className="text-white">{pkg.tote_count}</strong> reusable totes
                  </p>
                  <p className="text-xs text-stone-500">From ${(cheapest / 100).toFixed(0)}</p>
                </button>
              );
            })}
          </div>
        </section>

        {selectedPackage && (
          <section>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
              2. Rental length
            </h2>
            <div className="flex flex-wrap gap-2">
              {selectedPackage.pricing_tiers.map((tier) => {
                const isSelected = durationDays === tier.duration_days;
                return (
                  <button
                    key={tier.duration_days}
                    type="button"
                    onClick={() => setDurationDays(tier.duration_days)}
                    className={`rounded-xl border px-5 py-3 text-sm font-semibold transition-all ${
                      isSelected
                        ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300"
                        : "border-slate-800 bg-slate-900/40 text-stone-300 hover:border-slate-700"
                    }`}
                  >
                    {tier.duration_days} days &middot;{" "}
                    <span className={isSelected ? "text-white" : "text-stone-400"}>
                      ${(tier.price_cents / 100).toFixed(0)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
            3. Recipient
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Recipient name" value={recipientName} onChange={setRecipientName} placeholder="Jane Doe" />
            <TextField
              label="Recipient email"
              value={recipientEmail}
              onChange={setRecipientEmail}
              placeholder="jane@example.com"
              type="email"
            />
            <TextField
              label="Recipient phone (optional)"
              value={recipientPhone}
              onChange={setRecipientPhone}
              placeholder="(555) 123-4567"
              type="tel"
              className="sm:col-span-2"
            />
            <TextField
              label="Property address (optional)"
              value={propertyAddress}
              onChange={setPropertyAddress}
              placeholder="123 Main St, Springfield"
              className="sm:col-span-2"
            />
            <TextField
              label="Property ZIP"
              value={propertyZip}
              onChange={setPropertyZip}
              placeholder="62704"
              maxLength={5}
              required
            />
          </div>

          {/* ── Coverage status (live as ZIP is typed) ──────────────── */}
          <div className="mt-3">
            <CoverageStatusPill
              status={coverageStatus}
              message={coverageMessage}
            />
          </div>
          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-medium text-stone-400">
              Personal note (optional)
            </label>
            <textarea
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              maxLength={400}
              rows={3}
              placeholder="Congrats on the new place — couldn't be happier for you!"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-stone-500 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
            />
            <p className="mt-1 text-[11px] text-stone-500">
              Shows up on the gift email and the recipient page. {personalMessage.length}/400.
            </p>
          </div>
        </section>
      </div>

      {/* ── Right: order summary + checkout ────────────────────────── */}
      <aside className="lg:sticky lg:top-10 lg:self-start">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
            Summary
          </p>

          {selectedPackage && selectedTier ? (
            <>
              <p className="mb-1 text-lg font-bold">{selectedPackage.name}</p>
              <p className="mb-5 text-sm text-stone-400">
                {selectedPackage.tote_count} totes &middot; {selectedTier.duration_days}-day rental
              </p>

              <ul className="mb-6 space-y-2">
                {selectedPackage.features.slice(0, 5).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-stone-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mb-6 flex items-end justify-between border-t border-slate-800 pt-4">
                <span className="text-sm text-stone-400">Total</span>
                <span className="text-3xl font-black text-white">
                  ${(selectedTier.price_cents / 100).toFixed(0)}
                </span>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || coverageStatus === "no_coverage" || coverageStatus === "checking"}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-base font-bold text-slate-950 transition-all hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting…
                  </>
                ) : (
                  <>Send gift &amp; pay</>
                )}
              </button>

              <div className="mt-4 flex items-start gap-2 text-[11px] text-stone-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
                <span>
                  Secure checkout via Stripe. You&apos;re only charged once payment completes; your
                  recipient gets the link immediately after.
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-stone-400">Pick a package to see pricing.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  className?: string;
  required?: boolean;
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  className = "",
  required,
}: TextFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-stone-400">
        {label}
        {required && <span className="ml-1 text-amber-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-stone-500 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
      />
    </div>
  );
}

// ── Coverage status pill ──────────────────────────────────────────────────
// Renders the live ZIP-coverage state under the recipient form. Stays
// silent until a 5-digit ZIP has been entered; turns into a hard warning
// when no installer covers the area.
function CoverageStatusPill({
  status,
  message,
}: {
  status: "idle" | "checking" | "covered" | "no_coverage";
  message: string | null;
}) {
  if (status === "idle") return null;

  if (status === "checking") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-xs text-stone-300">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-stone-400" />
        <span className="leading-relaxed">Checking installer coverage&hellip;</span>
      </div>
    );
  }

  if (status === "covered") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/5 p-3 text-xs text-emerald-200">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <span className="leading-relaxed">
          A network installer covers this ZIP. You&rsquo;re good to send.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-400/5 p-3 text-xs text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <span className="leading-relaxed">
        {message ?? "No installer covers that ZIP yet."}
      </span>
    </div>
  );
}
