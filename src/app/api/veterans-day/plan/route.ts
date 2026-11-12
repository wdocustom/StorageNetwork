import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import {
  PlaceLookupError,
  assetFileReader,
  findPlacesNear,
  originFromCoords,
  originFromZip,
} from "@/lib/freebies/places.server";
import { planDay } from "@/lib/freebies/planner.server";
import { getOffer } from "@/lib/freebies/offers";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/veterans-day/plan
//
// Builds (or modifies) a veteran's day of freebies: resolves the starting
// point, reads nearby store locations from our own location files, and has
// Gemini choose and order the stops within the planner's rules. Public, rate-limited by IP.
// ═══════════════════════════════════════════════════════════════════════════

export const maxDuration = 60;

const slotPick = z.string().max(40).nullable().optional();

const BodySchema = z
  .object({
    zip: z.string().regex(/^\d{5}$/).optional(),
    lat: z.number().min(17).max(72).optional(),
    lon: z.number().min(-180).max(-64).optional(),
    startMin: z.number().int().min(0).max(1439),
    radiusMi: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(25)]),
    request: z.string().trim().max(300).optional(),
    current: z
      .object({
        breakfast: slotPick,
        treat_am: slotPick,
        lunch: slotPick,
        treat_pm: slotPick,
        dinner: slotPick,
      })
      .optional(),
  })
  .refine((b) => !!b.zip || (b.lat !== undefined && b.lon !== undefined), {
    message: "A ZIP code or a location is required.",
  });

export async function POST(req: NextRequest) {
  try {
    await enforceActionRateLimit({ action: "veterans-day-plan", limit: 15, window: "10 m", identify: "ip" });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    throw err;
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a 5-digit ZIP code or share your location." }, { status: 400 });
  }
  const { zip, lat, lon, startMin, radiusMi, request, current } = parsed.data;

  const origin = zip ? originFromZip(zip) : originFromCoords(lat!, lon!);
  if (!origin) {
    return NextResponse.json(
      { error: `We couldn't find ZIP code ${zip}. Double-check it, or share your location instead.` },
      { status: 400 }
    );
  }

  let places;
  try {
    places = await findPlacesNear(origin, radiusMi, assetFileReader(req.nextUrl.origin));
  } catch (err) {
    if (err instanceof PlaceLookupError) {
      console.error("[VeteransDay] place lookup failed:", err.message);
      return NextResponse.json(
        {
          error:
            "We couldn't load nearby locations just now. Please try again in a minute — the full list of offers is below in the meantime.",
        },
        { status: 503 }
      );
    }
    throw err;
  }

  const plan = await planDay({ places, origin, startMin, request: request || undefined, current });

  const onTimeline = new Set(plan.stops.map((s) => s.place.id));
  return NextResponse.json({
    origin,
    startMin,
    radiusMi,
    places,
    stops: plan.stops,
    summary: plan.summary,
    tips: plan.tips,
    ai: plan.ai,
    counts: {
      food: places.filter((p) => getOffer(p.offerId)?.kind !== "extra").length,
      extras: places.filter((p) => getOffer(p.offerId)?.kind === "extra" && !onTimeline.has(p.id)).length,
    },
  });
}
