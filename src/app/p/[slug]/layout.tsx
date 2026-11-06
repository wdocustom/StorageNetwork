import { CurrencyProvider } from "@/components/currency/CurrencyContext";
import { currencyForSlug } from "@/lib/server/currency-lookup";

// Prices on this page are in the installer's currency (CA$ for Canadian
// installers) — see @/components/currency/CurrencyContext.
export default async function CurrencyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CurrencyProvider currency={await currencyForSlug(slug)}>{children}</CurrencyProvider>;
}
