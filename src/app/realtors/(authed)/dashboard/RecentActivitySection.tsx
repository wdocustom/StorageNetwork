// ═══════════════════════════════════════════════════════════════════════════
// Recent activity feed for the realtor dashboard.
//
// Derives a timeline from this realtor's gift rows by collecting every
// non-null timestamp column (paid_at, redeemed_at, scheduled_at,
// installer_assigned_at, delivered_at, returned_at, cancelled_at) and
// sorting DESC. Shows the most recent N events with a friendly relative
// timestamp so the realtor sees their gifts moving along.
//
// Why these specific timestamps:
//   - skip `created_at` — that's the moment they CLICKED \"send\", not the
//     moment the gift exists from the recipient's perspective. `paid_at`
//     is the truthful \"gift was sent\" event.
//   - `redeemed_at` — recipient verified email (the first sign of life
//     from the buyer/seller, often the realtor's favorite moment).
//   - `scheduled_at` — recipient locked in delivery+pickup windows.
//   - `installer_assigned_at` — local pro accepted the job.
//   - `delivered_at` / `returned_at` — the physical milestones.
//   - `cancelled_at` — added by migration 112; closes the loop on a
//     cancellation so the timeline tells the full story.
//
// Computed entirely server-side, no client interactivity needed.
// ═══════════════════════════════════════════════════════════════════════════

import {
  Send,
  Mail,
  Calendar,
  Truck,
  Package as PackageIcon,
  CheckCircle2,
  XCircle,
  Activity,
  UserCheck,
} from "lucide-react";
import { getServiceClient } from "@/lib/supabase-server";

const MAX_EVENTS = 12;

type EventKind =
  | "sent"
  | "redeemed"
  | "scheduled"
  | "assigned"
  | "delivered"
  | "returned"
  | "cancelled";

interface ActivityEvent {
  giftId: string;
  recipientName: string;
  installerName: string | null;
  kind: EventKind;
  at: string; // ISO timestamp
}

// (icon, copy template, tint) per event kind. The copy uses {recipient}
// and {installer} placeholders that we substitute below.
const EVENT_META: Record<
  EventKind,
  { Icon: React.ComponentType<{ className?: string }>; copy: string; tint: string }
> = {
  sent: {
    Icon: Send,
    copy: "Sent a gift to {recipient}",
    tint: "text-stone-300",
  },
  redeemed: {
    Icon: Mail,
    copy: "{recipient} verified their email",
    tint: "text-blue-300",
  },
  scheduled: {
    Icon: Calendar,
    copy: "{recipient} scheduled delivery + pickup",
    tint: "text-yellow-300",
  },
  assigned: {
    Icon: UserCheck,
    copy: "{installer} picked up the job for {recipient}",
    tint: "text-yellow-300",
  },
  delivered: {
    Icon: Truck,
    copy: "{installer} delivered totes to {recipient}",
    tint: "text-blue-300",
  },
  returned: {
    Icon: CheckCircle2,
    copy: "{installer} completed pickup for {recipient}",
    tint: "text-emerald-300",
  },
  cancelled: {
    Icon: XCircle,
    copy: "Cancelled {recipient}'s gift",
    tint: "text-red-300",
  },
};

async function fetchEvents(realtorId: string): Promise<ActivityEvent[]> {
  const supabase = getServiceClient();
  const { data: gifts } = await supabase
    .from("tote_rental_gifts")
    .select(
      `id, recipient_name, paid_at, redeemed_at, scheduled_at,
       installer_assigned_at, delivered_at, returned_at, cancelled_at,
       profiles!tote_rental_gifts_installer_id_fkey ( first_name, last_name, business_name )`
    )
    .eq("realtor_id", realtorId);

  const events: ActivityEvent[] = [];
  for (const g of gifts ?? []) {
    const installer = g.profiles as unknown as
      | { first_name: string | null; last_name: string | null; business_name: string | null }
      | null;
    const installerName =
      installer?.business_name ||
      [installer?.first_name, installer?.last_name].filter(Boolean).join(" ") ||
      null;

    const pushIfDate = (kind: EventKind, raw: unknown) => {
      if (typeof raw === "string" && raw.length > 0) {
        events.push({
          giftId: g.id as string,
          recipientName: g.recipient_name as string,
          installerName,
          kind,
          at: raw,
        });
      }
    };

    pushIfDate("sent", g.paid_at);
    pushIfDate("redeemed", g.redeemed_at);
    pushIfDate("scheduled", g.scheduled_at);
    pushIfDate("assigned", g.installer_assigned_at);
    pushIfDate("delivered", g.delivered_at);
    pushIfDate("returned", g.returned_at);
    pushIfDate("cancelled", g.cancelled_at);
  }

  events.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return events.slice(0, MAX_EVENTS);
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return day === 1 ? "yesterday" : `${day} days ago`;
  // Older than a week → show short date
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function RecentActivitySection({ realtorId }: { realtorId: string }) {
  const events = await fetchEvents(realtorId);

  // Suppress the section entirely for brand-new realtors. The analytics
  // section already has a \"send your first gift\" empty state — we don't
  // want to double up on \"nothing yet\" prompts.
  if (events.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="mb-5 flex items-center gap-2">
        <Activity className="h-4 w-4 text-yellow-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-stone-300">
          Recent activity
        </h2>
      </div>

      <ol className="space-y-3">
        {events.map((e, i) => {
          const meta = EVENT_META[e.kind];
          const copy = meta.copy
            .replace("{recipient}", e.recipientName)
            .replace("{installer}", e.installerName || "Installer");
          return (
            <li key={`${e.giftId}-${e.kind}-${i}`} className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-slate-950/60 p-1.5 ring-1 ring-slate-800">
                <meta.Icon className={`h-3.5 w-3.5 ${meta.tint}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-stone-200">{copy}</p>
                <p className="text-[11px] text-stone-500">{formatRelative(e.at)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
