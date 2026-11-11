import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { EMAIL_VALIDATION_REGEX } from "@/lib/constants";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import { originFromCoords, verifyPlace } from "@/lib/freebies/places.server";
import { getOffer } from "@/lib/freebies/offers";
import { canFill, milesBetween, schedule, type PlanStop } from "@/lib/freebies/schedule";
import { sendFreebiePlanEmail } from "@/lib/emails/freebiePlanTemplates";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/veterans-day/email
//
// Emails a veteran their plan. The browser sends back the stops it is
// showing; each place must carry the signature our own lookup gave it, and
// the times are recomputed here, so the email can only ever contain real
// catalog offers at real locations. Public, tightly rate-limited by IP.
// ═══════════════════════════════════════════════════════════════════════════

const PlaceSchema = z.object({
  id: z.string().max(40),
  offerId: z.string().max(40),
  address: z.string().max(200).nullable(),
  city: z.string().max(80).nullable(),
  phone: z.string().max(20).nullable(),
  lat: z.number(),
  lon: z.number(),
  distanceMi: z.number(),
  sig: z.string().max(40),
});

const BodySchema = z.object({
  email: z.string().trim().max(254).regex(EMAIL_VALIDATION_REGEX),
  origin: z.object({ lat: z.number().min(17).max(72), lon: z.number().min(-180).max(-64) }),
  startMin: z.number().int().min(0).max(1439),
  stops: z
    .array(
      z.object({
        slot: z.enum(["breakfast", "treat_am", "lunch", "treat_pm", "dinner", "extra"]),
        place: PlaceSchema,
      })
    )
    .min(1)
    .max(10),
  extras: z.array(PlaceSchema).max(12),
});

export async function POST(req: NextRequest) {
  try {
    await enforceActionRateLimit({ action: "veterans-day-email", limit: 5, window: "1 h", identify: "ip" });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    throw err;
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const { email, origin, startMin, extras } = parsed.data;
  const stops: PlanStop[] = parsed.data.stops;

  const genuine =
    [...stops.map((s) => s.place), ...extras].every((p) => !!getOffer(p.offerId) && verifyPlace(p)) &&
    stops.every((s) => canFill(s.place.offerId, s.slot)) &&
    extras.every((p) => getOffer(p.offerId)?.kind === "extra");
  if (!genuine) {
    return NextResponse.json(
      { error: "This plan is out of date. Generate it again, then send the email." },
      { status: 400 }
    );
  }

  // Distances are display-only and not signed; measure them here.
  const measure = <T extends { lat: number; lon: number }>(p: T) => ({
    ...p,
    distanceMi: Number(milesBetween(origin, p).toFixed(2)),
  });
  const timed = schedule(
    stops.map((s) => ({ slot: s.slot, place: measure(s.place) })),
    origin,
    startMin
  );

  const result = await sendFreebiePlanEmail(email, {
    originLabel: originFromCoords(origin.lat, origin.lon).label,
    stops: timed,
    extras: extras.map(measure),
  });
  if (!result.success) {
    console.error("[VeteransDay] plan email failed:", result.error);
    return NextResponse.json(
      { error: "We couldn't send the email just now. Please try again." },
      { status: 502 }
    );
  }
  return NextResponse.json({ success: true });
}
