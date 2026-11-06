import { CurrencyProvider } from "@/components/currency/CurrencyContext";
import { currencyForInstaller } from "@/lib/server/currency-lookup";

// Prices on this page are in the installer's currency (CA$ for Canadian
// installers) — see @/components/currency/CurrencyContext.
export default async function CurrencyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ installerId: string }>;
}) {
  const { installerId } = await params;
  return <CurrencyProvider currency={await currencyForInstaller(installerId)}>{children}</CurrencyProvider>;
}
