import { ArrowLeft } from "lucide-react";
import RefundFreeEntryForm from "@/components/legal/RefundFreeEntryForm";
import { REFUND_GIVEAWAY, formatGiveawayDate, giveawayStatus } from "@/lib/refund-giveaway";

// ═══════════════════════════════════════════════════════════════════════════
// Holiday Full Refund Giveaway — Official Rules (/refund-rules)
//
// Same layout as /legal/terms. Every detail that varies (sponsor, dates, day
// counts, contact) comes from @/lib/refund-giveaway; anything not filled in
// yet renders as a highlighted [placeholder] so it can't go out unnoticed.
// ═══════════════════════════════════════════════════════════════════════════

export const metadata = {
  title: "Holiday Full Refund Giveaway — Official Rules | Storage Network",
  description:
    "Official Rules for the Storage-Network.app Holiday Full Refund Giveaway: eligibility, how to enter (no purchase necessary), daily drawings, prizes and conditions.",
  alternates: { canonical: "/refund-rules" },
};

// Re-render as dates pass (the free-entry form opens and closes with the promotion).
export const dynamic = "force-dynamic";

const RULES_UPDATED = "November 18, 2026";

/** A detail that hasn't been filled in yet: impossible to miss. */
function Blank({ children }: { children: React.ReactNode }) {
  return <mark className="rounded bg-amber-400/20 px-1 font-semibold text-amber-300">{children}</mark>;
}

function Value({ value, blank }: { value: string | number | null; blank: string }) {
  return value == null || value === "" ? <Blank>[{blank}]</Blank> : <>{value}</>;
}

function Email({ address }: { address: string }) {
  return (
    <a href={`mailto:${address}`} className="text-yellow-400 hover:underline">
      {address}
    </a>
  );
}

const h2 = "mt-8 text-lg font-bold text-white";

export default function RefundRulesPage() {
  const g = REFUND_GIVEAWAY;
  const status = giveawayStatus();
  const start = g.startDate ? formatGiveawayDate(g.startDate) : null;
  const end = g.endDate ? formatGiveawayDate(g.endDate) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-stone-300">
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <a href="/plans" aria-label="Back to plans" className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <h1 className="text-sm font-bold uppercase tracking-wider text-white">Official Rules</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="prose prose-invert prose-sm max-w-none">
          <p className="text-2xl font-extrabold leading-tight text-white">{g.name}</p>
          <p className="text-xs text-stone-500">Last updated: {RULES_UPDATED}</p>

          <p className="rounded-xl border border-slate-800 bg-slate-900 p-4 font-semibold text-stone-200">
            NO PURCHASE NECESSARY TO ENTER OR WIN. A purchase does not increase your chances of winning. Void where
            prohibited. Open to legal residents of the 50 United States and the District of Columbia who are 18 or older.
          </p>

          <h2 className={h2}>1. Sponsor</h2>
          <p>
            The {g.name} (the &quot;Promotion&quot;) is sponsored by Storage-Network.app, operated by{" "}
            <Value value={g.sponsorLegalName} blank="legal business name" />,{" "}
            <Value value={g.sponsorCityState} blank="city, state" /> (the &quot;Sponsor&quot;).
          </p>

          <h2 className={h2}>2. Promotion period</h2>
          <p>
            The Promotion starts on <Value value={start} blank="start date" /> at 12:00 AM Central Time and ends on{" "}
            <Value value={end} blank="end date" /> at 11:59 PM Central Time (the &quot;Promotion Period&quot;). Each calendar
            day in Central Time (12:00 AM to 11:59 PM) is its own daily drawing period. Entries count only toward the
            drawing for the day they are received.
          </p>

          <h2 className={h2}>3. Eligibility</h2>
          <p>
            The Promotion is open only to legal residents of the 50 United States and the District of Columbia who are 18
            years of age or older at the time of entry. Void where prohibited or restricted by law. Employees of the
            Sponsor, and members of their immediate families and households, are not eligible.
          </p>

          <h2 className={h2}>4. How to enter</h2>
          <p>There are two ways to enter. Both have the same chance of winning.</p>
          <p>
            <strong className="text-white">a. Purchase entry.</strong> Every completed purchase of DIY build plans on
            Storage-Network.app during a daily drawing period receives one entry into that day&apos;s drawing. A gift
            purchase counts as one entry per order, no matter how many people it includes. Purchases that are later
            refunded outside this Promotion, or charged back, are not eligible.
          </p>
          <p>
            <strong className="text-white">b. NO PURCHASE NECESSARY free entry.</strong> Anyone can enter for free, either
            by emailing <Email address={g.entryEmail} /> with the subject line &quot;Holiday Refund Entry&quot; and your full
            name and email address in the message, or by using the free entry form below. Limit one free entry per person
            per day, by either method. Free entries have the same chance of winning as purchase entries. Entries are
            timestamped when received; an emailed entry counts toward the day (Central Time) it arrives.
          </p>
          <p>
            If a winner drawn from free entries did not make a qualifying purchase that day, their prize is one free
            lifetime DIY plans account (approximate retail value: the price of DIY plans on Storage-Network.app on the day of
            the drawing) instead of a refund.
          </p>

          <div className="not-prose my-6">
            <RefundFreeEntryForm status={status} startDate={g.startDate} />
          </div>

          <h2 className={h2}>5. Winner selection</h2>
          <p>
            Several winners are selected at random each day from all eligible entries received for that day&apos;s
            drawing period, as determined by the Sponsor. The number of winners for each day is set by the Sponsor and
            may vary from day to day. The odds of winning depend on the number of eligible entries received for that
            day. The Sponsor&apos;s decisions are final.
          </p>

          <h2 className={h2}>6. Prize</h2>
          <p>
            Each prize is a full refund of the amount the winner paid for their DIY plans purchase from that day, issued to the original
            payment method within <Value value={g.refundBusinessDays} blank="X" /> business days after the winner is
            confirmed. Approximate retail value of each prize: the amount paid for that purchase (the price of the plans at the time of
            purchase). The winner keeps the plans. Prizes are not
            transferable, and no cash alternative or substitution is available, except the refund itself (or the free
            plans account described in section 4b). Any taxes on a prize are the winner&apos;s responsibility.
          </p>

          <h2 className={h2}>7. Notification</h2>
          <p>
            Winners are notified by email, at the address used to enter, within <Value value={g.notifyDays} blank="X" />{" "}
            days of their drawing. The Sponsor may publish a winner&apos;s first name and last initial, unless prohibited by
            law.
          </p>

          <h2 className={h2}>8. General conditions</h2>
          <p>
            The Sponsor may cancel, suspend or modify the Promotion if fraud, technical problems or any other cause beyond
            its control affects its administration, security or fairness. An entry is void if the purchase is charged
            back, or refunded outside this Promotion. The Sponsor may disqualify anyone who tampers with the entry process
            or breaks these rules. Limit one prize per person per day. Entries that are incomplete, late, automated or
            sent in bulk are void.
          </p>

          <h2 className={h2}>9. Limitation of liability and release</h2>
          <p>
            By entering, you agree to these Official Rules and to the Sponsor&apos;s decisions. To the fullest extent
            allowed by law, you release the Sponsor and its owners, employees and agents from any liability for any loss,
            injury or damage arising from your entry, your participation in the Promotion, or any prize. The Sponsor is
            not responsible for lost, late, misdirected or incomplete entries or emails, or for technical failures of any
            kind.
          </p>

          <h2 className={h2}>10. Privacy</h2>
          <p>
            Information you give when entering is used only to run the Promotion (including notifying winners and issuing
            prizes), as described in our{" "}
            <a href="/legal/privacy" className="text-yellow-400 hover:underline">
              Privacy Policy
            </a>
            .
          </p>

          <h2 className={h2}>11. Not affiliated with Instagram or Meta</h2>
          <p>This promotion is in no way sponsored, endorsed, administered by, or associated with Instagram or Meta.</p>

          <h2 className={h2}>12. Winners list and contact</h2>
          <p>
            To request the list of winners, or with any questions about the Promotion, email{" "}
            {g.contactEmail ? <Email address={g.contactEmail} /> : <Blank>[email]</Blank>}.
          </p>

          <div className="mt-12 rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
            <p className="text-xs text-stone-500">&copy; 2026 Storage-Network.app. All rights reserved.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
