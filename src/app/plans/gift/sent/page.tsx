import Image from "next/image";
import Link from "next/link";
import GiftOrderManager from "@/components/plans/GiftOrderManager";

// ═══════════════════════════════════════════════════════════════════════════
// /plans/gift/sent
//   ?session_id=cs_…   Stripe's return after paying (swapped for ?order=)
//   ?order=<token>     the "Manage my gifts" link in the receipt email
// ═══════════════════════════════════════════════════════════════════════════

const clean = (v: string | string[] | undefined, re: RegExp) => (typeof v === "string" && re.test(v) ? v : undefined);

export default async function GiftSentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sessionId = clean(params.session_id, /^cs_[A-Za-z0-9_]+$/);
  const manageToken = clean(params.order, /^[0-9a-f-]{36}$/i);

  return (
    <div className="min-h-screen bg-slate-950 pb-16 text-stone-300 antialiased">
      <header className="mx-auto flex max-w-xl items-center justify-center px-5 pt-5">
        <Link href="/plans" aria-label="Storage Network plans">
          <Image src="/landing_page_logo.png" alt="Storage Network" width={84} height={32} className="h-8 w-auto" />
        </Link>
      </header>
      <main className="mx-auto max-w-xl px-5">
        <GiftOrderManager sessionId={sessionId} manageToken={manageToken} />
      </main>
    </div>
  );
}
