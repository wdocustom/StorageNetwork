import { CurrencyProvider } from "@/components/currency/CurrencyContext";
import { currencyForTrackToken } from "@/lib/server/currency-lookup";

// Prices on this page are in the installer's currency (CA$ for Canadian
// installers) — see @/components/currency/CurrencyContext.
export default async function CurrencyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CurrencyProvider currency={await currencyForTrackToken(token)}>{children}</CurrencyProvider>;
}
