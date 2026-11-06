import { describe, expect, it } from "vitest";
import { currencySymbol, localizeMoneyText, usdMoney } from "./currency";

describe("currencySymbol", () => {
  it("is $ for USD and CA$ for CAD", () => {
    expect(currencySymbol("usd")).toBe("$");
    expect(currencySymbol(null)).toBe("$");
    expect(currencySymbol("cad")).toBe("CA$");
  });
});

describe("localizeMoneyText", () => {
  const html = `<p>Deposit $150.00 paid — balance $ 850 · 30% off · $${"{x}"}</p>`;

  it("leaves USD (and missing currency) output byte-for-byte unchanged", () => {
    expect(localizeMoneyText(html, "usd")).toBe(html);
    expect(localizeMoneyText(html, undefined)).toBe(html);
  });

  it("rewrites every $<amount> as CA$<amount> for CAD", () => {
    expect(localizeMoneyText("Deposit $150.00, balance $ 850, -$20", "cad")).toBe(
      "Deposit CA$150.00, balance CA$ 850, -CA$20"
    );
  });

  it("does not touch non-money dollar signs or already-prefixed amounts", () => {
    expect(localizeMoneyText("US$9 · CA$5 · $var · cost: $", "cad")).toBe("US$9 · CA$5 · $var · cost: $");
  });

  it("renders always-USD amounts as US$ in CAD emails and strips the marker otherwise", () => {
    const text = `Your build: $1,200 · DIY plans from ${usdMoney("$9")}`;
    expect(localizeMoneyText(text, "cad")).toBe("Your build: CA$1,200 · DIY plans from US$9");
    expect(localizeMoneyText(text, "usd")).toBe("Your build: $1,200 · DIY plans from $9");
  });
});
