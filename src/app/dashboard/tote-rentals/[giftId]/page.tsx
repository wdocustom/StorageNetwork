// ═══════════════════════════════════════════════════════════════════════════
// Installer → Tote Rentals → [giftId]
//
// Per-job detail view. Surfaces everything the installer needs to do the
// job: recipient contact (with mailto/tel/sms links), realtor contact for
// coordination, delivery + pickup windows, the realtor's personal message,
// payout breakdown by leg, status timeline, and the early-pickup banner
// when the recipient has signaled they're done early.
//
// Auth: must be the assigned installer (getInstallerToteJob enforces this).
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Truck,
  User,
} from "lucide-react";

import { getAuthenticatedUser } from "@/lib/auth";
import { getInstallerToteJob } from "@/app/actions/realtor-gift-fulfillment";
import { formatPhoneForDisplay } from "@/lib/phone";

import { JobMilestoneButtons } from "./JobMilestoneButtons";

interface PageProps {
  params: Promise<{ giftId: string }>;
}

export default async function InstallerJobDetailPage({ params }: PageProps) {
  const { giftId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const job = await getInstallerToteJob(giftId);
  if (!job) notFound();

  const totalPayoutCents = job.delivery_fee_cents + job.pickup_fee_cents;
  const phoneDisplay = formatPhoneForDisplay(job.recipient_phone);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <Link
          href="/dashboard/tote-rentals"
          className="mb-8 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          All tote rental jobs
        </Link>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
              Tote Rental Job
            </p>
            <h1 className="text-3xl font-black sm:text-4xl">
              Gift for {job.recipient_name}
            </h1>
            <p className="mt-1 text-sm text-stone-400">
              {job.tote_count} totes &middot; {job.duration_days}-day rental
              {job.dispatch_source === "inventory" && (
                <span className="ml-2 rounded-full border border-yellow-400/30 bg-yellow-400/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-300">
                  Inventory
                </span>
              )}
            </p>
          </div>
          <StatusPill status={job.status} />
        </div>

        {/* ── Early-pickup banner ─────────────────────────────────────── */}
        {job.pickup_early_requested_at && job.status === "delivered" && (
          <div className="mb-6 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-5">
            <div className="mb-2 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <p className="text-sm font-bold text-amber-100">
                  {job.recipient_name} is ready for pickup
                </p>
                <p className="text-xs leading-relaxed text-amber-200/80">
                  Signaled {formatRelative(job.pickup_early_requested_at)}. They&rsquo;re done
                  with the totes early — reach out below to coordinate or stick
                  with the scheduled window.
                </p>
              </div>
            </div>
            {job.pickup_early_note && (
              <p className="ml-8 mt-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm italic text-amber-100">
                &ldquo;{job.pickup_early_note}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* ── Action bar (milestone buttons) ──────────────────────────── */}
        <div className="mb-10">
          <JobMilestoneButtons giftId={job.id} status={job.status} />
        </div>

        {/* ── Body: two columns ───────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Left: contact + message */}
          <div className="space-y-6">
            <ContactCard
              title="Recipient"
              icon={User}
              accent="yellow"
              rows={[
                { icon: User, label: "Name", value: job.recipient_name },
                {
                  icon: Mail,
                  label: "Email",
                  value: (
                    <a
                      href={`mailto:${job.recipient_email}`}
                      className="text-yellow-300 hover:text-yellow-200"
                    >
                      {job.recipient_email}
                    </a>
                  ),
                },
                {
                  icon: Phone,
                  label: "Phone",
                  value: phoneDisplay && job.recipient_phone ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <a
                        href={`tel:${job.recipient_phone}`}
                        className="text-yellow-300 hover:text-yellow-200"
                      >
                        {phoneDisplay}
                      </a>
                      <a
                        href={`sms:${job.recipient_phone}`}
                        className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-300 hover:bg-yellow-400/20"
                      >
                        Text
                      </a>
                    </span>
                  ) : (
                    <span className="text-stone-500">Not provided</span>
                  ),
                },
                {
                  icon: MapPin,
                  label: "Address",
                  value: job.delivery_address || (
                    <span className="text-stone-500">
                      Pending — recipient confirms at /gift link
                    </span>
                  ),
                },
              ]}
            />

            {job.personal_message && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-yellow-300" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
                    Realtor&rsquo;s note to recipient
                  </p>
                </div>
                <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm italic leading-relaxed text-stone-200">
                  &ldquo;{job.personal_message}&rdquo;
                </p>
                <p className="mt-3 text-[11px] text-stone-500">
                  Context only — the recipient already saw this on their gift page.
                </p>
              </div>
            )}

            <ContactCard
              title="Realtor (for coordination)"
              icon={User}
              accent="slate"
              rows={[
                {
                  icon: User,
                  label: "Sent by",
                  value: (
                    <>
                      {job.realtor.name}
                      {job.realtor.brokerage && (
                        <span className="text-stone-500"> &middot; {job.realtor.brokerage}</span>
                      )}
                    </>
                  ),
                },
                {
                  icon: Mail,
                  label: "Email",
                  value: job.realtor.email ? (
                    <a
                      href={`mailto:${job.realtor.email}`}
                      className="text-stone-200 hover:text-yellow-300"
                    >
                      {job.realtor.email}
                    </a>
                  ) : (
                    <span className="text-stone-500">Not provided</span>
                  ),
                },
              ]}
            />
          </div>

          {/* Right: summary + payout + timeline */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Package className="h-4 w-4 text-yellow-300" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
                  Job summary
                </p>
              </div>
              <dl className="space-y-3 text-sm">
                <SummaryRow label="Package" value={job.package_name} />
                <SummaryRow label="Totes" value={`${job.tote_count} × 27-gallon`} />
                <SummaryRow label="Rental" value={`${job.duration_days} days`} />
                <SummaryRow
                  label="Delivery window"
                  value={formatWindow(job.delivery_window_start, job.delivery_window_end)}
                />
                <SummaryRow
                  label="Pickup window"
                  value={formatWindow(job.pickup_window_start, job.pickup_window_end)}
                />
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="mb-4 flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-emerald-300" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
                  Payout
                </p>
              </div>
              <dl className="space-y-3 text-sm">
                <SummaryRow
                  label={`Delivery + pickup (${job.tote_count} totes)`}
                  value={`$${(totalPayoutCents / 100).toFixed(2)}`}
                />
              </dl>
              <div className="mt-4 flex items-end justify-between border-t border-slate-800 pt-4">
                <span className="text-sm text-stone-400">Total</span>
                <span className="text-2xl font-black text-emerald-300">
                  ${(totalPayoutCents / 100).toFixed(2)}
                </span>
              </div>
              <p className="mt-3 text-[11px] text-stone-500">
                {job.paid_at ? (
                  <>Transferred to your Stripe account on {formatDate(job.paid_at)}.</>
                ) : job.status === "returned" ? (
                  <>Pickup logged — Stripe transfer is on the way.</>
                ) : (
                  <>One flat payout, transferred after you mark the gift returned.</>
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-yellow-300" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
                  Timeline
                </p>
              </div>
              <Timeline
                assignedAt={job.assigned_at}
                deliveredAt={job.delivered_at}
                returnedAt={job.returned_at}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    assigned: {
      label: "Assigned to you",
      cls: "border-yellow-400/40 bg-yellow-400/10 text-yellow-200",
    },
    delivered: {
      label: "Delivered",
      cls: "border-blue-400/40 bg-blue-400/10 text-blue-200",
    },
    returned: {
      label: "Returned",
      cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    },
    cancelled: {
      label: "Cancelled",
      cls: "border-red-400/40 bg-red-400/10 text-red-200",
    },
  };
  const meta = map[status] ?? {
    label: status,
    cls: "border-slate-700 bg-slate-900 text-stone-300",
  };
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

interface ContactRow {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}

function ContactCard({
  title,
  icon: Icon,
  accent,
  rows,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "yellow" | "slate";
  rows: ContactRow[];
}) {
  const borderClass =
    accent === "yellow"
      ? "border-yellow-400/30 bg-yellow-400/[0.03]"
      : "border-slate-800 bg-slate-900/40";

  const iconClass = accent === "yellow" ? "text-yellow-300" : "text-stone-400";

  return (
    <div className={`rounded-2xl border p-6 ${borderClass}`}>
      <div className="mb-4 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
          {title}
        </p>
      </div>
      <dl className="space-y-3 text-sm">
        {rows.map((row, i) => (
          <div key={i} className="flex items-start gap-3">
            <row.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
            <div className="min-w-0 flex-1">
              <dt className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500">
                {row.label}
              </dt>
              <dd className="text-sm text-stone-200">{row.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-800 pb-2 last:border-0 last:pb-0">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-white">{value}</dd>
    </div>
  );
}

function Timeline({
  assignedAt,
  deliveredAt,
  returnedAt,
}: {
  assignedAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
}) {
  const items = [
    { label: "Assigned", at: assignedAt, icon: Truck, done: !!assignedAt },
    { label: "Delivered", at: deliveredAt, icon: Package, done: !!deliveredAt },
    { label: "Returned", at: returnedAt, icon: CheckCircle2, done: !!returnedAt },
  ];

  return (
    <ol className="relative space-y-4 border-l border-slate-800 pl-6">
      {items.map((step) => {
        const Icon = step.icon;
        return (
          <li key={step.label} className="relative">
            <span
              className={`absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-slate-950 ${
                step.done ? "bg-emerald-400" : "bg-slate-700"
              }`}
            >
              {step.done && <Icon className="h-2.5 w-2.5 text-slate-950" strokeWidth={3} />}
            </span>
            <p className={`text-sm font-semibold ${step.done ? "text-white" : "text-stone-500"}`}>
              {step.label}
            </p>
            <p className="text-[11px] text-stone-500">
              {step.at ? formatDate(step.at) : "Pending"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

// ── Date formatting ─────────────────────────────────────────────────────

function formatWindow(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const startD = new Date(start);
  const endD = new Date(end);
  const sameDay = startD.toDateString() === endD.toDateString();
  if (sameDay) {
    return `${startD.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, ${startD.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}–${endD.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  return `${startD.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} → ${endD.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
