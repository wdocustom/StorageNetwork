"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Currency context — which dollar a screen is showing.
//
// Canadian installers charge in CAD (see @/lib/geo/currency). Any screen
// that shows a job's money — the installer's dashboard, and every customer
// page tied to a Canadian installer — is wrapped in <CurrencyProvider> with
// that installer's currency, and money renders as "CA$1,234".
//
// The default is USD with the plain "$" symbol, so a tree with no provider
// (every US installer and customer, and platform-priced pages like DIY
// plans) renders exactly as before.
// ═══════════════════════════════════════════════════════════════════════════

import { createContext, useContext, type ReactNode } from "react";
import { normalizeCurrency, currencySymbol, type CurrencyCode } from "@/lib/geo/currency";

interface CurrencyValue {
  currency: CurrencyCode;
  /** "$" for USD, "CA$" for CAD. */
  symbol: string;
  /**
   * Symbol for amounts that are ALWAYS US dollars whatever the screen's
   * currency (platform-paid partner commissions, DIY plan prices): plain "$"
   * on a USD screen, "US$" on a CAD screen so the two never get confused.
   */
  usdSymbol: string;
}

const CurrencyContext = createContext<CurrencyValue>({ currency: "usd", symbol: "$", usdSymbol: "$" });

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: string | null | undefined;
  children: ReactNode;
}) {
  const cur = normalizeCurrency(currency);
  return (
    <CurrencyContext.Provider
      value={{ currency: cur, symbol: currencySymbol(cur), usdSymbol: cur === "usd" ? "$" : "US$" }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyValue {
  return useContext(CurrencyContext);
}

/** The money symbol for the surrounding context — "$" or "CA$". */
export function CurrencySymbol() {
  return <>{useContext(CurrencyContext).symbol}</>;
}

/** For amounts that are always USD — "$", or "US$" on a CAD screen. */
export function UsdSymbol() {
  return <>{useContext(CurrencyContext).usdSymbol}</>;
}
