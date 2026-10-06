import { describe, it, expect } from "vitest";
import { extractPastUnits, pickInstallAddress } from "./repeat-order-units";

describe("extractPastUnits", () => {
  it("keeps standard racks with their options and quantity", () => {
    const out = extractPastUnits([
      { cols: 4, rows: 4, toteType: "HDX", hasTotes: true, hasWheels: true, hasTop: false, quantity: 2, price: 500 },
      { cols: 3, rows: 5, toteType: "GM", hasTotes: false, hasWheels: false, hasTop: true },
    ]);
    expect(out).toEqual([
      { cols: 4, rows: 4, toteType: "HDX", hasTotes: true, hasWheels: true, hasTop: false, quantity: 2 },
      { cols: 3, rows: 5, toteType: "GM", hasTotes: false, hasWheels: false, hasTop: true, quantity: 1 },
    ]);
  });

  it("flags custom builds instead of silently re-pricing them as a plain rack", () => {
    const out = extractPastUnits([
      { cols: 4, rows: 4, toteType: "HDX", hasTotes: true, addons: [{ type: "doors" }] },
      { cols: 2, rows: 2, toteType: "HDX", unitType: "mini" },
      { cols: 4, rows: 2, shelvingConfigId: "x" },
    ]);
    expect(out).toHaveLength(3);
    expect(out.every((u) => u.unavailableLabel && u.cols === undefined)).toBe(true);
  });

  it("ignores services and junk", () => {
    expect(extractPastUnits([{ type: "cleanout_service", name: "x", price: 5 }, null, "x", { cols: 0, rows: 2 }])).toEqual([]);
    expect(extractPastUnits(undefined)).toEqual([]);
  });
});

describe("pickInstallAddress", () => {
  it("prefers the delivery address", () => {
    expect(
      pickInstallAddress({
        delivery_address_line1: "12 Elm St",
        delivery_address_city: "Omaha",
        delivery_address_state: "NE",
        delivery_address_zip: "68102",
        address_line1: "999 Billing Ave",
        address_zip: "11111",
      })
    ).toEqual({ address: "12 Elm St, Omaha, NE", zip: "68102" });
  });

  it("falls back to the service address, then the free-text address", () => {
    expect(pickInstallAddress({ address_line1: "5 Oak", address_city: "Lincoln", address_zip: "68508" })).toEqual({
      address: "5 Oak, Lincoln",
      zip: "68508",
    });
    expect(pickInstallAddress({ address: "7 Pine Rd" })).toEqual({ address: "7 Pine Rd", zip: "" });
  });

  it("returns blanks when nothing is on file", () => {
    expect(pickInstallAddress({})).toEqual({ address: "", zip: "" });
  });
});
