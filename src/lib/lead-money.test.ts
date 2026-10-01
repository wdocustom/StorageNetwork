import { describe, it, expect } from "vitest";
import { computeBalanceDue, describeAddon, parseTipCents, quoteTotals } from "./lead-money";

const unit = (over: Record<string, unknown> = {}) => ({
  price: 0,
  desc: "4×3 rack",
  hasTop: false,
  hasWheels: false,
  hasTotes: true,
  ...over,
});

describe("quoteTotals", () => {
  it("adds unit prices, indoor delivery and delivery fee; taxes only the build", () => {
    const t = quoteTotals(
      [
        { price: 500, indoorDelivery: true, indoorDeliveryFee: 25 },
        { price: 200, toteType: "cleanout" },
      ],
      40
    );
    expect(t.total).toBe(765);
    expect(t.taxable).toBe(500);
  });
});

describe("post-deposit add-on example", () => {
  // $1,050 order, 15% deposit paid; installer adds a $150 top.
  const afterDeposit = {
    estimated_price: 1050,
    deposit_amount: 157.5,
    deposit_paid: true,
    discount_amount: 0,
    sales_tax_amount: 0,
  };

  it("balance is 1050 − 157.50 before the add-on", () => {
    expect(computeBalanceDue(afterDeposit)).toBe(892.5);
  });

  it("add-on raises the balance by its full amount until its deposit is paid", () => {
    expect(computeBalanceDue({ ...afterDeposit, estimated_price: 1200 })).toBe(1042.5);
  });

  it("after the $22.50 add-on deposit, deposits total $180 and the customer owes $1,020", () => {
    const lead = { ...afterDeposit, estimated_price: 1200, deposit_amount: 157.5 + 22.5 };
    expect(lead.deposit_amount).toBe(180);
    expect(computeBalanceDue(lead)).toBe(1020);
  });
});

describe("computeBalanceDue", () => {
  it("does not credit a deposit that was never paid", () => {
    expect(
      computeBalanceDue({
        estimated_price: 1431,
        deposit_amount: 357.75,
        deposit_paid: false,
        discount_amount: 0,
        sales_tax_amount: 0,
      })
    ).toBe(1431);
  });

  it("subtracts the discount and adds sales tax", () => {
    expect(
      computeBalanceDue({
        estimated_price: 1000,
        deposit_amount: 150,
        deposit_paid: true,
        discount_amount: 50,
        sales_tax_amount: 60,
      })
    ).toBe(860);
  });

  it("treats nulls as zero", () => {
    expect(
      computeBalanceDue({
        estimated_price: 100,
        deposit_amount: null,
        deposit_paid: true,
        discount_amount: null,
        sales_tax_amount: null,
      })
    ).toBe(100);
  });
});

describe("parseTipCents", () => {
  it("treats empty as no tip", () => {
    expect(parseTipCents("")).toEqual({ cents: 0 });
    expect(parseTipCents(null)).toEqual({ cents: 0 });
    expect(parseTipCents(undefined)).toEqual({ cents: 0 });
  });

  it("parses free-form amounts to cents", () => {
    expect(parseTipCents("25")).toEqual({ cents: 2500 });
    expect(parseTipCents("$1,020.50")).toEqual({ cents: 102050 });
    expect(parseTipCents(12.345)).toEqual({ cents: 1235 });
  });

  it("rejects negative, non-numeric and oversized tips", () => {
    expect(parseTipCents(-5)).toHaveProperty("error");
    expect(parseTipCents("abc")).toHaveProperty("error");
    expect(parseTipCents(5001)).toHaveProperty("error");
  });
});

describe("describeAddon", () => {
  it("names a top or wheels added to an existing unit", () => {
    expect(describeAddon([unit({ price: 1050 })], [unit({ price: 1200, hasTop: true })])).toBe("Unit 1: + top");
    expect(
      describeAddon([unit({ price: 100 })], [unit({ price: 165, hasWheels: true, hasTop: true })])
    ).toBe("Unit 1: + top, wheels");
  });

  it("names a whole new unit", () => {
    expect(describeAddon([unit({ price: 100 })], [unit({ price: 100 }), unit({ price: 300, desc: "Overhead rack" })])).toBe(
      "+ Overhead rack"
    );
  });

  it("labels a size swap even when the new unit moved to the end", () => {
    const rack = (cols: number, rows: number, price: number) => unit({ cols, rows, price, desc: `${cols}×${rows} rack` });
    const overhead = unit({ price: 380, desc: "Overhead 3×3", hasTotes: true });
    // Installer removed the 4×3 and added a 4×4: it's now second in the list.
    expect(describeAddon([rack(4, 3, 450), overhead], [overhead, rack(4, 4, 600)])).toBe("Unit 2: 4×3 → 4×4");
  });

  it("lists a removed unit that wasn't replaced", () => {
    const a = unit({ cols: 4, rows: 3, price: 450, desc: "4×3 rack" });
    const b = unit({ cols: 2, rows: 2, price: 200, desc: "2×2 rack" });
    const big = unit({ cols: 6, rows: 4, price: 900, desc: "6×4 rack" });
    expect(describeAddon([a, b], [big])).toBe("Unit 1: 4×3 → 6×4; − 2×2 rack");
  });

  it("falls back when nothing identifiable changed", () => {
    expect(describeAddon([unit({ price: 100 })], [unit({ price: 100 })])).toBe("Quote updated");
  });
});
