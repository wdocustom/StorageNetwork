"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Mail, MapPin, Calendar } from "lucide-react";

import {
  requestGiftMagicCode,
  verifyGiftMagicCode,
  scheduleGiftDelivery,
  type RecipientGiftView,
} from "@/app/actions/realtor-gifts";

// ═══════════════════════════════════════════════════════════════════════════
// GiftRecipientFlow — client state machine for the recipient page.
//
// Three terminal panels:
//   - "verify"   : recipient hasn't proven email yet (status=paid)
//   - "schedule" : verified, hasn't picked windows yet (status=redeemed)
//   - "done"     : windows are set (status=scheduled or later)
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  token: string;
  gift: RecipientGiftView;
}

export function GiftRecipientFlow({ token, gift }: Props) {
  // Server is the source of truth on first load; subsequent transitions
  // update the local view optimistically.
  const [phase, setPhase] = useState<"verify" | "schedule" | "done">(
    gift.scheduled ? "done" : gift.redeemed ? "schedule" : "verify"
  );

  if (phase === "done") {
    return <DonePanel gift={gift} />;
  }
  if (phase === "schedule") {
    return <SchedulePanel token={token} gift={gift} onScheduled={() => setPhase("done")} />;
  }
  return <VerifyPanel token={token} gift={gift} onVerified={() => setPhase("schedule")} />;
}

// ── Panel 1: Magic-link verify ────────────────────────────────────────────

function VerifyPanel({
  token,
  gift,
  onVerified,
}: {
  token: string;
  gift: RecipientGiftView;
  onVerified: () => void;
}) {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function requestCode() {
    setError("");
    setInfo("");
    setLoading(true);
    const result = await requestGiftMagicCode(token);
    setLoading(false);
    if (result.ok) {
      setInfo(`We sent a 6-digit code to ${maskEmail(gift.recipientEmail)}. It expires in 15 minutes.`);
      setStep("verify");
    } else {
      setError(result.error || "Couldn't send the code. Please try again.");
    }
  }

  async function submitCode() {
    setError("");
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    const result = await verifyGiftMagicCode(token, code.trim());
    setLoading(false);
    if (result.ok) {
      onVerified();
    } else {
      setError(result.error || "Invalid code.");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <Mail className="h-5 w-5 text-yellow-400" />
        <h2 className="text-lg font-bold">Verify your email</h2>
      </div>

      {step === "request" ? (
        <>
          <p className="mb-6 text-sm leading-relaxed text-stone-300">
            We&apos;ll send a 6-digit code to{" "}
            <strong className="text-white">{maskEmail(gift.recipientEmail)}</strong> to confirm
            it&apos;s really you. Enter the code on the next screen to unlock your gift and pick
            a delivery window.
          </p>
          <button
            onClick={requestCode}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-yellow-300 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending&hellip;
              </>
            ) : (
              <>Send my code</>
            )}
          </button>
        </>
      ) : (
        <>
          {info && (
            <div className="mb-4 rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-200">
              {info}
            </div>
          )}
          <label className="mb-1.5 block text-xs font-medium text-stone-400">
            Enter the 6-digit code
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submitCode()}
            placeholder="123456"
            className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
          />

          {error && (
            <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={submitCode}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-yellow-300 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
            </button>
            <button
              onClick={requestCode}
              disabled={loading}
              className="text-xs text-stone-400 hover:text-yellow-400"
            >
              Send a new code
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Panel 2: Schedule delivery + pickup ───────────────────────────────────

function SchedulePanel({
  token,
  gift,
  onScheduled,
}: {
  token: string;
  gift: RecipientGiftView;
  onScheduled: () => void;
}) {
  const [deliveryAddress, setDeliveryAddress] = useState(gift.propertyAddress || "");
  const [deliveryZip, setDeliveryZip] = useState(gift.propertyZip || "");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState<"morning" | "afternoon">("morning");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function buildWindow(date: string, timeOfDay: "morning" | "afternoon"): { start: Date; end: Date } | null {
    if (!date) return null;
    const start = new Date(`${date}T${timeOfDay === "morning" ? "09:00:00" : "13:00:00"}`);
    if (Number.isNaN(start.valueOf())) return null;
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // 4h window
    return { start, end };
  }

  async function submit() {
    setError("");
    if (!deliveryAddress.trim() || !deliveryZip.trim() || !deliveryDate) {
      setError("Address, ZIP, and a delivery date are required.");
      return;
    }
    const deliveryWindow = buildWindow(deliveryDate, deliveryTime);
    if (!deliveryWindow) {
      setError("Please pick a valid delivery date.");
      return;
    }
    // Pickup window auto-calculated from the rental length, same time of day.
    const pickupStart = new Date(deliveryWindow.end.getTime() + (gift.durationDays * 24 - 4) * 60 * 60 * 1000);
    const pickupEnd = new Date(pickupStart.getTime() + 4 * 60 * 60 * 1000);

    setLoading(true);
    const result = await scheduleGiftDelivery({
      token,
      deliveryAddress: deliveryAddress.trim(),
      deliveryZip: deliveryZip.trim(),
      deliveryWindowStart: deliveryWindow.start.toISOString(),
      deliveryWindowEnd: deliveryWindow.end.toISOString(),
      pickupWindowStart: pickupStart.toISOString(),
      pickupWindowEnd: pickupEnd.toISOString(),
    });
    setLoading(false);

    if (result.ok) {
      onScheduled();
    } else {
      setError(result.error || "Couldn't save your schedule. Please try again.");
    }
  }

  // Earliest delivery: 2 days out (gives the installer dispatch a buffer).
  const minDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <Calendar className="h-5 w-5 text-yellow-400" />
        <h2 className="text-lg font-bold">Schedule your delivery</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Delivery address"
          value={deliveryAddress}
          onChange={setDeliveryAddress}
          placeholder="123 Main St, Springfield, IL"
          className="sm:col-span-2"
        />
        <Field label="ZIP" value={deliveryZip} onChange={(v) => setDeliveryZip(v.replace(/\D/g, "").slice(0, 5))} placeholder="62704" />
        <Field
          label="Delivery date"
          type="date"
          value={deliveryDate}
          onChange={setDeliveryDate}
          min={minDate}
        />

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-stone-400">Time window</label>
          <div className="flex gap-2">
            {(["morning", "afternoon"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDeliveryTime(t)}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                  deliveryTime === t
                    ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300"
                    : "border-slate-700 bg-slate-950 text-stone-300 hover:border-slate-600"
                }`}
              >
                {t === "morning" ? "Morning (9 AM – 1 PM)" : "Afternoon (1 PM – 5 PM)"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs text-stone-400">
        <strong className="text-stone-200">Pickup:</strong> automatically scheduled for the
        same time window, {gift.durationDays} days after delivery. We&apos;ll confirm both with
        your installer.
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={loading}
        className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-yellow-300 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm schedule"}
      </button>
    </div>
  );
}

// ── Panel 3: Confirmed ────────────────────────────────────────────────────

function DonePanel({ gift }: { gift: RecipientGiftView }) {
  const formatWindow = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const s = new Date(start);
    const e = new Date(end);
    const date = s.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const time = `${s.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })} – ${e.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })}`;
    return { date, time };
  };

  const delivery = formatWindow(gift.deliveryWindowStart, gift.deliveryWindowEnd);
  const pickup = formatWindow(gift.pickupWindowStart, gift.pickupWindowEnd);

  // Headline copy varies by gift lifecycle stage.
  const headline = gift.returned
    ? "Move complete."
    : gift.delivered
      ? "Your totes are here."
      : gift.installerName
        ? "You're scheduled."
        : "You're scheduled.";

  const lead = gift.returned
    ? `${gift.installerName ?? "Your installer"} picked up the totes. Hope the new place is starting to feel like home.`
    : gift.delivered
      ? `${gift.installerName ?? "Your installer"} dropped off your totes. Pack on your own schedule — pickup is already booked.`
      : gift.installerName
        ? `${gift.installerName} from the Storage Network installer network is set to handle your delivery and pickup.`
        : "We're routing a local pro from the Storage Network installer network to your area. You'll get an email the moment they're assigned.";

  return (
    <>
      <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-yellow-400" />
          <h2 className="text-lg font-bold">{headline}</h2>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-stone-300">{lead}</p>

        <div className="space-y-4">
          {delivery && (
            <ScheduleRow
              icon={<MapPin className="h-4 w-4 text-yellow-400" />}
              heading={gift.delivered ? "Delivered" : "Delivery"}
              primary={delivery.date}
              secondary={delivery.time}
              tertiary={gift.deliveryAddress || undefined}
            />
          )}
          {pickup && (
            <ScheduleRow
              icon={<MapPin className="h-4 w-4 text-yellow-400" />}
              heading={gift.returned ? "Picked up" : "Pickup"}
              primary={pickup.date}
              secondary={pickup.time}
              tertiary={gift.deliveryAddress || undefined}
            />
          )}
        </div>
      </div>

      {/* Post-delivery cross-sell — once the totes are physically with the
          recipient, surface the installer's permanent-rack designer. The
          card is even more prominent after pickup (returned state) when
          the recipient is settled and giving up their last bit of packing
          infrastructure. */}
      {(gift.delivered || gift.returned) && gift.installerSlug && (
        <InstallerCrossSell
          installerName={gift.installerName ?? "Your installer"}
          slug={gift.installerSlug}
          variant={gift.returned ? "post-pickup" : "post-delivery"}
        />
      )}
    </>
  );
}

function InstallerCrossSell({
  installerName,
  slug,
  variant,
}: {
  installerName: string;
  slug: string;
  variant: "post-delivery" | "post-pickup";
}) {
  const designUrl = `/design?installer=${slug}`;
  const profileUrl = `/p/${slug}`;

  const headline =
    variant === "post-pickup"
      ? "Love your totes? Keep them."
      : "Want to keep them forever?";
  const body =
    variant === "post-pickup"
      ? `${installerName} builds custom heavy-duty storage racks designed for the same totes you just used. Garage, basement, pantry — the clutter never comes back.`
      : `Once you're settled, ${installerName} also builds custom storage racks designed for the same totes. Lock in storage that actually lasts.`;

  return (
    <div className="mt-6 rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/10 to-transparent p-6 sm:p-8">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
        From {installerName}
      </p>
      <h3 className="mb-3 text-xl font-bold text-white">{headline}</h3>
      <p className="mb-5 text-sm leading-relaxed text-stone-300">{body}</p>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={designUrl}
          className="rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-yellow-300"
        >
          Design my rack
        </a>
        <a
          href={profileUrl}
          className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-stone-300 hover:border-slate-600"
        >
          See {installerName}&apos;s portfolio
        </a>
      </div>
    </div>
  );
}

function ScheduleRow({
  icon,
  heading,
  primary,
  secondary,
  tertiary,
}: {
  icon: React.ReactNode;
  heading: string;
  primary: string;
  secondary: string;
  tertiary?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-yellow-400">{heading}</p>
        <p className="font-semibold text-white">{primary}</p>
        <p className="text-sm text-stone-400">{secondary}</p>
        {tertiary && <p className="mt-1 text-xs text-stone-500">{tertiary}</p>}
      </div>
    </div>
  );
}

// ── Shared field ──────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: string;
  className?: string;
}
function Field({ label, value, onChange, placeholder, type = "text", min, className = "" }: FieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-stone-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-stone-500 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
      />
    </div>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}
