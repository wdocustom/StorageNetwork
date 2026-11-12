import { nextVeteransDayYear, veteransDayIcs } from "@/lib/freebies/veterans-day-date";

// ═══════════════════════════════════════════════════════════════════════════
// GET /veterans-day/calendar.ics
//
// "Add to calendar" for Apple Calendar, Outlook desktop, Android and any
// other calendar app: the next Veterans Day as an all-day event that repeats
// every November 11, with a reminder the day before. iPhone Safari opens it
// straight into "Add to Calendar".
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export function GET() {
  const now = new Date();
  return new Response(veteransDayIcs(nextVeteransDayYear(now, true), now), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="veterans-day.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
