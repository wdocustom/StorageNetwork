import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CurrencyProvider, CurrencySymbol, UsdSymbol, useCurrency } from "./CurrencyContext";

function Price({ amount }: { amount: number }) {
  const { symbol } = useCurrency();
  return (
    <span>
      <CurrencySymbol />
      {amount} | {`${symbol}${amount}`} | plans <UsdSymbol />9
    </span>
  );
}

describe("CurrencyContext", () => {
  it("renders exactly as before with no provider (US)", () => {
    expect(renderToStaticMarkup(<Price amount={150} />)).toBe("<span>$150 | $150 | plans $9</span>");
  });

  it("renders CA$ for a Canadian installer and labels always-USD amounts US$", () => {
    expect(
      renderToStaticMarkup(
        <CurrencyProvider currency="cad">
          <Price amount={150} />
        </CurrencyProvider>
      )
    ).toBe("<span>CA$150 | CA$150 | plans US$9</span>");
  });
});
