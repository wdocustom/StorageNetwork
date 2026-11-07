import { describe, expect, it } from "vitest";
import {
  TOTE_PLAN_SALE_CENTS,
  TOTE_PLAN_SALE_SINCE,
  TOTE_PLAN_TIERS,
  TOTE_PLAN_UPGRADE_PRICE,
  totePlanPricePaid,
} from "./tote-plans";

describe("tote plan sale", () => {
  it("charges list price minus the sale on both tiers", () => {
    expect(TOTE_PLAN_TIERS.pdf.listPrice).toBe(1900);
    expect(TOTE_PLAN_TIERS.interactive.listPrice).toBe(2900);
    expect(TOTE_PLAN_TIERS.pdf.price).toBe(1900 - TOTE_PLAN_SALE_CENTS);
    expect(TOTE_PLAN_TIERS.interactive.price).toBe(2900 - TOTE_PLAN_SALE_CENTS);
  });

  it("keeps the PDF → interactive upgrade at the list difference", () => {
    expect(TOTE_PLAN_UPGRADE_PRICE).toBe(1000);
  });

  it("prices analytics by when the plan was bought", () => {
    expect(totePlanPricePaid("pdf", "2026-10-20T10:40:00Z")).toBe(1900);
    expect(totePlanPricePaid("pdf", `${TOTE_PLAN_SALE_SINCE}T15:00:00Z`)).toBe(TOTE_PLAN_TIERS.pdf.price);
  });
});
