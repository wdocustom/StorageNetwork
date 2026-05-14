"use client";

import { AlertTriangle, CheckCircle2, Loader2, Mail, MapPin } from "lucide-react";

import type { DeliveryPreview } from "@/app/actions/realtor-tote-delivery";

// ═══════════════════════════════════════════════════════════════════════════
// Distance gate — renders one of four states for the inventory-mode gift
// form based on the previewToteGiftDelivery result.
//
//   loading       — preview in flight
//   free          — distance ≤ 50 mi; "Delivery included"
//   surcharge     — 51–75 mi; "Extended delivery + $25"
//   inquire       — > 75 mi; mailto button instead of Send Gift
//   no_coverage   — no installer covers this ZIP
//
// Caller controls the Send button — this component just communicates state.
// For 'inquire', the caller renders the mailto from this component's
// returned data (the installer email + suggested subject).
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  loading: boolean;
  preview: DeliveryPreview | null;
  zipEntered: boolean;
  /** Recipient + delivery details for the mailto template on 'inquire'. */
  recipientName: string;
  deliveryAddress: string;
  deliveryZip: string;
  toteCount: number;
  durationDays: number;
}

export function DeliveryDistanceGate({
  loading,
  preview,
  zipEntered,
  recipientName,
  deliveryAddress,
  deliveryZip,
  toteCount,
  durationDays,
}: Props) {
  if (!zipEntered) {
    return (
      <Pill tone="neutral" icon={MapPin}>
        Enter a 5-digit delivery ZIP to preview delivery pricing.
      </Pill>
    );
  }

  if (loading) {
    return (
      <Pill tone="neutral" icon={Loader2} spinIcon>
        Checking delivery distance&hellip;
      </Pill>
    );
  }

  if (!preview) return null;

  if (preview.tier === "no_coverage") {
    return (
      <Pill tone="warning" icon={AlertTriangle}>
        {preview.message}
      </Pill>
    );
  }

  if (preview.tier === "free") {
    return (
      <Pill tone="success" icon={CheckCircle2}>
        <span className="font-semibold">Delivery included.</span>{" "}
        {preview.message}
      </Pill>
    );
  }

  if (preview.tier === "surcharge") {
    return (
      <Pill tone="info" icon={MapPin}>
        <span className="font-semibold">Extended delivery: +$25.</span>{" "}
        {preview.message}
      </Pill>
    );
  }

  // tier === 'inquire'
  const installerEmail = preview.installer?.email;
  const installerName = preview.installer?.displayName ?? "installer";

  const mailtoHref = installerEmail
    ? buildMailto(installerEmail, {
        installerName,
        recipientName,
        deliveryAddress,
        deliveryZip,
        toteCount,
        durationDays,
        distanceMiles: preview.distanceMiles ?? 0,
      })
    : null;

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
      <div className="mb-3 flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div>
          <p className="mb-1 text-sm font-semibold text-amber-100">
            Outside automatic delivery range
          </p>
          <p className="text-xs leading-relaxed text-amber-200/80">
            {preview.message}
          </p>
        </div>
      </div>
      {mailtoHref && (
        <a
          href={mailtoHref}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-100 transition-colors hover:bg-amber-400/20"
        >
          <Mail className="h-3.5 w-3.5" />
          Inquire with {installerName}
        </a>
      )}
    </div>
  );
}

// ── Pill primitive ────────────────────────────────────────────────────────

type Tone = "neutral" | "success" | "warning" | "info";

function Pill({
  tone,
  icon: Icon,
  spinIcon,
  children,
}: {
  tone: Tone;
  icon: React.ComponentType<{ className?: string }>;
  spinIcon?: boolean;
  children: React.ReactNode;
}) {
  const classes: Record<Tone, string> = {
    neutral: "border-slate-700 bg-slate-900/40 text-stone-300",
    success: "border-emerald-400/40 bg-emerald-400/5 text-emerald-200",
    warning: "border-amber-400/40 bg-amber-400/5 text-amber-100",
    info:    "border-yellow-400/40 bg-yellow-400/5 text-yellow-100",
  };
  const iconClasses: Record<Tone, string> = {
    neutral: "text-stone-400",
    success: "text-emerald-300",
    warning: "text-amber-300",
    info:    "text-yellow-300",
  };

  return (
    <div className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${classes[tone]}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClasses[tone]} ${spinIcon ? "animate-spin" : ""}`} />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

// ── Mailto builder ────────────────────────────────────────────────────────

function buildMailto(
  to: string,
  ctx: {
    installerName: string;
    recipientName: string;
    deliveryAddress: string;
    deliveryZip: string;
    toteCount: number;
    durationDays: number;
    distanceMiles: number;
  }
): string {
  const subject =
    `Closing-gift inquiry — ${ctx.toteCount} totes to ${ctx.deliveryZip} ` +
    `(${ctx.distanceMiles} mi)`;

  const body =
    `Hi ${ctx.installerName},\n\n` +
    `I'd like to send a closing gift through StorageNetwork, but the ` +
    `delivery distance is outside the standard 75-mile range. Would you ` +
    `be willing to quote this one directly?\n\n` +
    `Recipient: ${ctx.recipientName || "(name TBD)"}\n` +
    `Delivery to: ${ctx.deliveryAddress || ctx.deliveryZip}\n` +
    `Totes: ${ctx.toteCount} × 27-gallon\n` +
    `Rental window: ${ctx.durationDays} days\n` +
    `Distance: ${ctx.distanceMiles} mi from your service ZIP\n\n` +
    `Thanks!\n`;

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
