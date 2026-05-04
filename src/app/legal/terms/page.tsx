import { ArrowLeft } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Terms of Service — Legal Framework for The Storage-Network
// ═══════════════════════════════════════════════════════════════════════════

export const metadata = {
  title: "Terms of Service | Storage Network",
  description:
    "Terms of Service for Storage Network. Covers installer accounts, customer bookings, payment processing, platform usage, and dispute resolution for tote rack installation services.",
  alternates: {
    canonical: "/legal/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-stone-300">
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <a
            href="/"
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <h1 className="text-sm font-bold uppercase tracking-wider text-white">
            Terms of Service
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="prose prose-invert prose-sm max-w-none">
          <p className="text-xs text-stone-500">
            Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">1. Nature of Service</h2>
          <p>
            The Storage-Network (&quot;Platform,&quot; &quot;we,&quot; &quot;us&quot;) is a technology
            marketplace that connects homeowners and property managers (&quot;Customers&quot;) with
            independent contractor installers (&quot;Installers&quot;) who provide custom tote-based
            garage storage solutions.
          </p>
          <p>
            The Platform facilitates discovery, scheduling, and payment processing between Customers
            and Installers. <strong>The Storage-Network is not a construction company, general
            contractor, or employer of Installers.</strong> All installation services are performed
            by independent contractors who maintain their own business licenses, insurance, and tools.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">2. User Accounts</h2>
          <p>
            You must provide accurate, current, and complete information when creating an account.
            You are responsible for maintaining the confidentiality of your login credentials and
            for all activities that occur under your account. Notify us immediately of any
            unauthorized use.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">3. Booking &amp; Payment Terms</h2>
          <p>
            When a Customer books an installation through the Platform, a deposit of 15% of the
            quoted total is collected at the time of booking. This deposit is processed via Stripe
            and is subject to Stripe&apos;s terms of service.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The remaining 85% balance is due upon completion of the installation.</li>
            <li>A platform service fee of up to 15% is applied to each transaction, depending on the installer&apos;s plan and lead source.</li>
            <li>All prices quoted through the configurator are estimates; final pricing may vary
              based on site conditions.</li>
          </ul>

          <h2 className="mt-8 text-lg font-bold text-white">
            3b. Upsell Services &amp; Network Lead Fees
          </h2>
          <p>
            The Platform may offer optional add-on services (&quot;Upsell Services&quot;) to Customers
            in connection with a scheduled installation. These include, but are not limited to,
            garage cleanout services offered prior to an installation date.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Network Lead Fee:</strong> A <strong>10% network lead fee</strong> is applied
              to all Upsell Services facilitated through the Platform. This fee is calculated on the
              total price of the upsell item and is deducted from the transaction before installer
              payout.
            </li>
            <li>
              <strong>Upsell Deposit:</strong> Customers may be required to pay a 50% deposit at
              the time of confirming an Upsell Service. The remaining balance is collected at the
              time of service.
            </li>
            <li>
              <strong>Installer Payout:</strong> After the 10% network lead fee is deducted, the
              installer receives their share of the upsell payment according to the Platform&apos;s
              standard payout schedule.
            </li>
            <li>
              <strong>Applicable Services:</strong> The 10% network lead fee applies to all
              Platform-facilitated upsell items including, but not limited to: garage cleanout
              services, organizational add-ons, and any additional services offered through the
              Platform&apos;s automated upsell system.
            </li>
          </ul>

          <h2 id="payment-method-on-file" className="mt-8 text-lg font-bold text-white">
            3c. Saved Payment Method &amp; Authorization to Charge Remaining Balance
          </h2>
          <p>
            <strong>Plain-language summary.</strong> When you pay your deposit, the same card is securely
            tokenized and stored by Stripe so the Installer can collect the remaining balance after
            the installation is complete without you having to enter your card details again. You can
            still pay the balance any other way you want (cash, check, transfer, a different card),
            and you can revoke this authorization at any time before the balance is collected.
          </p>
          <p className="mt-3">
            By submitting your deposit through the Platform, you (the &quot;Customer&quot;) expressly authorize
            The Storage-Network and the assigned Installer to store the payment method used for the
            deposit and to initiate one (1) subsequent charge to that payment method for the
            remaining balance owed under your booking, on the terms set out below. This authorization
            is a written agreement to a Merchant-Initiated Transaction (&quot;MIT&quot;) within the meaning of
            applicable card network rules and is intended to satisfy any &quot;off-session&quot; mandate or
            recurring-credentials disclosure requirement of Visa, Mastercard, American Express,
            Discover, and Stripe, Inc.
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-3">
            <li>
              <strong>Amount.</strong> The amount that may be charged is the remaining balance shown
              on your booking, calculated as: the quoted job total, minus your deposit, minus any
              applied discount, plus any applicable sales tax disclosed to you at booking. The
              charged amount will not exceed this calculated balance.
            </li>
            <li>
              <strong>Timing &amp; trigger.</strong> The charge is <em>not</em> automatic and is
              <em>not</em> time-scheduled. It runs only when the Installer affirmatively elects to
              collect the balance via the saved card after the installation has been performed,
              typically on the day of installation. The Platform does not initiate this charge on
              its own based on calendar dates, job statuses, or any passive condition.
            </li>
            <li>
              <strong>Right to pay another way.</strong> You retain the right to pay the balance by
              cash, check, ACH, Venmo, Zelle, a different card, or any other method the Installer
              accepts. If you do, the Installer will record that payment in the Platform and the
              saved card will not be charged for the balance. If you intend to pay another way, tell
              your Installer before the installation is complete so the saved card is not used.
            </li>
            <li>
              <strong>Single use.</strong> This authorization is for a single balance charge tied to
              a single booking. It does not authorize subscriptions, recurring charges, top-ups, or
              charges for any other order. A separate authorization is collected for each booking
              you make.
            </li>
            <li>
              <strong>Revocation.</strong> You may revoke this authorization at any time before the
              balance has been charged by (a) emailing{" "}
              <a href="mailto:support@storage-network.app" className="underline">
                support@storage-network.app
              </a>
              {" "}from the email address on your booking, or (b) instructing your Installer in
              writing (text or email) to remove the saved card. Revocation does not affect any
              charge already made and does not relieve you of your obligation to pay the balance by
              another method.
            </li>
            <li>
              <strong>Authentication.</strong> If your card issuer requires customer authentication
              (e.g., 3-D Secure / Strong Customer Authentication) for the balance charge, the
              Platform will send you a payment link by email and the saved card will not be charged
              off-session unless and until you complete that authentication.
            </li>
            <li>
              <strong>Declines &amp; failed charges.</strong> A failed authorization on the saved
              card does not extinguish your obligation to pay the balance. You agree to promptly
              provide an alternative payment method or settle the balance directly with the
              Installer.
            </li>
            <li>
              <strong>Receipts.</strong> A digital receipt is emailed automatically to the email
              address on your booking when the saved card is successfully charged.
            </li>
            <li>
              <strong>Refunds &amp; disputes.</strong> Any refund of a balance charge will be issued
              to the same card used for the deposit, through Stripe, on the Platform&apos;s and
              Installer&apos;s standard timeline. Disputes initiated through your card issuer are
              governed by your card network&apos;s rules.
            </li>
            <li>
              <strong>Storage &amp; security.</strong> The Platform does not store your full card
              number. The card is tokenized by Stripe (a PCI-DSS Level 1 service provider) and only
              a non-sensitive token plus the last four digits are accessible to the Platform and
              Installer for the purpose described above.
            </li>
          </ul>
          <p className="mt-3">
            If you do not agree to this Section 3c, do not complete the deposit. Submitting the
            deposit constitutes your agreement to this Section, the rest of these Terms, Stripe&apos;s
            Services Agreement, and the network rules of the card brand on the payment method you
            used.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">4. Cancellation &amp; Refund Policy</h2>
          <p>
            Customers may cancel a booking with a full deposit refund if cancellation is made
            at least <strong>24 hours before the scheduled installation date</strong>. Cancellations
            made less than 24 hours before the scheduled date forfeit the deposit.
          </p>
          <p>
            Installers who cancel within 24 hours of a confirmed booking may be subject to
            account penalties, including temporary suspension from the Platform.
          </p>

          <h2 id="installation" className="mt-8 text-lg font-bold text-white">
            5. Installation Agreement &amp; Workmanship Warranty
          </h2>
          <p>
            All Installers on The Storage-Network agree to the following standards:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>30-Day Workmanship Warranty:</strong> Installers guarantee their work for
              30 days from the date of installation. If a structural defect arises due to
              installation error within this period, the Installer will return to correct the
              issue at no additional charge.
            </li>
            <li>
              <strong>Material Accuracy:</strong> Installers will use materials consistent with
              the build plan generated by the Platform configurator.
            </li>
            <li>
              <strong>Professional Conduct:</strong> Installers will arrive on time, communicate
              proactively about delays, and leave the work area clean upon completion.
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-bold text-white">6. Limitation of Liability</h2>
          <p>
            <strong>The Storage-Network is a technology platform and assumes no liability for
            property damage, personal injury, or any loss arising from the installation services
            performed by Installers.</strong> The Installer is solely responsible for the quality,
            safety, and compliance of their work.
          </p>
          <p>
            To the maximum extent permitted by law, The Storage-Network&apos;s total liability
            for any claim related to the Platform shall not exceed the amount of fees paid by
            the claimant to the Platform in the 12 months preceding the claim.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">7. Contractor Agreement</h2>
          <p>
            By joining The Storage-Network as an Installer, you acknowledge and agree that:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>You are an independent contractor, not an employee of The Storage-Network.</li>
            <li>You are responsible for your own taxes, insurance, and business compliance.</li>
            <li>You will maintain appropriate general liability insurance for the services you provide.</li>
            <li>You grant The Storage-Network a non-exclusive license to use your business name,
              logo, and service area information for marketing purposes on the Platform.</li>
            <li>You will honor the 30-day workmanship warranty described in Section 5.</li>
          </ul>

          <h2 className="mt-8 text-lg font-bold text-white">8. Intellectual Property</h2>
          <p>
            All content on the Platform, including the build configurator, 3D visualizer,
            cut plan algorithms, and brand assets, is the property of Storage-Network.app and
            is protected by applicable intellectual property laws. You may not reproduce,
            distribute, or create derivative works without written permission.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">9. Dispute Resolution</h2>
          <p>
            Any disputes arising from the use of the Platform shall be resolved through
            binding arbitration in accordance with the rules of the American Arbitration
            Association. The arbitration shall take place in the state of Nebraska.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">10. Modifications</h2>
          <p>
            We reserve the right to modify these Terms at any time. Material changes will
            be communicated via email or a prominent notice on the Platform. Continued use
            of the Platform after changes constitutes acceptance of the updated Terms.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">11. Contact</h2>
          <p>
            For questions about these Terms, contact us at{" "}
            <a href="mailto:support@storage-network.app" className="text-yellow-400 hover:underline">
              support@storage-network.app
            </a>.
          </p>

          <div className="mt-12 rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
            <p className="text-xs text-stone-500">
              &copy; {new Date().getFullYear()} Storage-Network.app. All rights reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
