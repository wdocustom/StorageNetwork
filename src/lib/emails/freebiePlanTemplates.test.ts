import { describe, expect, it } from "vitest";

import { freebiePlanEmailHtml, freebiePlanSubject } from "./freebiePlanTemplates";
import { formatTime, schedule, type Place } from "@/lib/freebies/schedule";

const ORIGIN = { lat: 30.2672, lon: -97.7431 };

function place(offerId: string, over: Partial<Place> = {}): Place {
  return {
    id: `node/${offerId}`,
    offerId,
    address: "100 Main St, Austin, TX 78701",
    city: "Austin",
    phone: "(512) 555-0100",
    lat: 30.28,
    lon: -97.73,
    distanceMi: 1.2,
    sig: "x",
    ...over,
  };
}

describe("freebie plan email", () => {
  const stops = schedule(
    [
      { slot: "breakfast", place: place("dennys") },
      { slot: "lunch", place: place("applebees", { lat: 30.3, address: null }) },
    ],
    ORIGIN,
    7 * 60 + 30
  );
  const html = freebiePlanEmailHtml({ originLabel: "Austin, TX", stops, extras: [place("great-clips")] });

  it("lists every stop with its time, offer and where it is", () => {
    expect(freebiePlanSubject()).toContain("Veterans Day");
    expect(html).toContain("Thank you for your service.");
    expect(html).toContain("starting near Austin, TX");
    for (const stop of stops) expect(html).toContain(formatTime(stop.arrive));
    expect(stops[0].arrive).toBeGreaterThan(7 * 60 + 30);
    expect(html).toContain("Free Original Grand Slam");
    expect(html).toContain("Applebee&#39;s");
    expect(html).toContain("100 Main St, Austin, TX 78701");
  });

  it("gives each stop a directions button and an offer-details button", () => {
    expect(html.match(/Get directions/g)).toHaveLength(3);
    expect(html.match(/Offer details/g)).toHaveLength(3);
    expect(html).toContain("https://www.google.com/maps/dir/?api=1&amp;destination=Denny");
    expect(html).toContain("/veterans-day#offer-dennys");
    expect(html).toContain("/veterans-day#offer-great-clips");
    expect(html).toContain("Open the whole route in Maps");
    expect(html).toContain('href="tel:+15125550100"');
  });

  it("includes what to bring and the non-food section", () => {
    expect(html).toContain("Bring proof of service");
    expect(html).toContain("DD-214");
    expect(html).toContain("More near you — not food");
    expect(html).toContain("Free haircut cards are good through December 4, 2026.");
  });

  it("escapes place text", () => {
    const evil = freebiePlanEmailHtml({
      originLabel: "<b>x</b>",
      stops: schedule([{ slot: "breakfast", place: place("dennys", { address: '<img src=x onerror="1">' }) }], ORIGIN, 450),
      extras: [],
    });
    expect(evil).not.toContain("<img src=x");
    expect(evil).not.toContain("<b>x</b>");
  });
});
