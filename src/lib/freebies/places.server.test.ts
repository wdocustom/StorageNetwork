import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { findPlacesNear, locationFileKeys, rowToPlace, verifyPlace, type LocationRow } from "./places.server";

const OMAHA = { lat: 41.257, lon: -95.995 };

const row = (offerId: string, lat: number, lon: number, extra: Partial<Record<3 | 4 | 5 | 6 | 7 | 8, string>> = {}): LocationRow => [
  offerId,
  lat,
  lon,
  extra[3] ?? "3040 Dial Dr",
  extra[4] ?? "Council Bluffs",
  extra[5] ?? "IA",
  extra[6] ?? "51501",
  extra[7] ?? "7123186100",
  extra[8] ?? `${offerId}-${lat}`,
];

describe("location files", () => {
  it("reads every 1°×1° square the radius touches", () => {
    // Omaha sits near the line between two squares.
    expect(locationFileKeys(OMAHA, 5).sort()).toEqual(["41_-96", "41_-97"]);
    expect(locationFileKeys({ lat: 41.5, lon: -95.5 }, 5)).toEqual(["41_-96"]);
    expect(locationFileKeys({ lat: 41.98, lon: -95.02 }, 10).sort()).toEqual(["41_-95", "41_-96", "42_-95", "42_-96"]);
  });

  it("turns a row into a place with a full address and phone", () => {
    expect(rowToPlace(row("ihop", 41.22978, -95.85019))).toEqual({
      id: "atp/ihop-41.22978",
      offerId: "ihop",
      address: "3040 Dial Dr, Council Bluffs, IA 51501",
      city: "Council Bluffs",
      phone: "(712) 318-6100",
      lat: 41.22978,
      lon: -95.85019,
    });
    // No street: no address line (directions use the pin), city kept.
    expect(rowToPlace(row("ihop", 41.2, -95.9, { 3: "", 7: "" }))).toMatchObject({ address: null, city: "Council Bluffs", phone: null });
    // An offer we no longer run is skipped.
    expect(rowToPlace(row("not-an-offer", 41.2, -95.9))).toBeNull();
  });

  it("finds the nearest locations across squares and signs them", async () => {
    const files: Record<string, LocationRow[]> = {
      "41_-96": [row("ihop", 41.23, -95.85), row("golden-corral", 41.26, -95.95), row("ihop", 41.9, -95.2)],
      "41_-97": [row("freddys", 41.26, -96.05)],
    };
    const read = vi.fn(async (key: string) => files[key] ?? []);
    const places = await findPlacesNear(OMAHA, 10, read);
    expect(read).toHaveBeenCalledTimes(2);
    expect(places.map((p) => p.offerId).sort()).toEqual(["freddys", "golden-corral", "ihop"]);
    expect(places.every((p) => p.distanceMi <= 10)).toBe(true);
    for (const p of places) expect(verifyPlace(p)).toBe(true);
    expect(verifyPlace({ ...places[0], address: "1 Somewhere Else" })).toBe(false);
  });
});
