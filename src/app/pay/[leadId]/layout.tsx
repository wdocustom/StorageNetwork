import { CurrencyProvider } from "@/components/currency/CurrencyContext";
import { currencyForLead } from "@/lib/server/currency-lookup";

// Prices on this page are in the installer's currency (CA$ for Canadian
// installers) — see @/components/currency/CurrencyContext.
export default async function CurrencyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  return <CurrencyProvider currency={await currencyForLead(leadId)}>{children}</CurrencyProvider>;
}
