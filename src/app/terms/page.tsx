import { ArrowLeft } from "lucide-react";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Terms of Service Page
// ═══════════════════════════════════════════════════════════════════════════

export const metadata = {
  title: "Terms of Service | Storage Network",
  description: "Terms of Service for the Storage Network platform",
};

export default function TermsPage() {
  const lastUpdated = "February 9, 2026";

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <a
            href="/design"
            className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Design
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold text-white">Terms of Service</h1>
        <p className="mb-8 text-sm text-stone-500">Last updated: {lastUpdated}</p>

        <div className="prose prose-invert prose-stone max-w-none">
          {/* Introduction */}
          <section className="mb-8">
            <p className="text-stone-300 leading-relaxed">
              Welcome to {siteConfig.name}. By accessing or using our platform, you agree to be bound
              by these Terms of Service. Please read them carefully before placing an order or using
              our services.
            </p>
          </section>

          {/* Section 1 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">1. Services Overview</h2>
            <p className="mb-4 text-stone-300 leading-relaxed">
              {siteConfig.name} is a platform that connects customers seeking custom tote storage
              systems with independent installers who build and install these systems. We provide:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>A design configurator for customers to create custom storage configurations</li>
              <li>Payment processing for deposits and final payments</li>
              <li>A network of independent installer partners</li>
              <li>Communication tools between customers and installers</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">2. Orders and Deposits</h2>
            <p className="mb-4 text-stone-300 leading-relaxed">
              When you place an order through our platform:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>
                <strong className="text-white">Deposit:</strong> A 15% deposit is required to confirm
                your order and reserve your installation date. This deposit is collected at the time
                of booking.
              </li>
              <li>
                <strong className="text-white">Balance:</strong> The remaining 85% is due upon
                completion of the installation, payable directly to your installer.
              </li>
              <li>
                <strong className="text-white">Pricing:</strong> All prices shown are estimates based
                on your configuration. Final pricing may vary based on site conditions or
                modifications requested during installation.
              </li>
            </ul>
          </section>

          {/* Section 2b — Upsell Services */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">
              2b. Upsell Services &amp; Network Lead Fees
            </h2>
            <p className="mb-4 text-stone-300 leading-relaxed">
              The Platform may offer optional add-on services (&quot;Upsell Services&quot;) in
              connection with your scheduled installation, such as garage cleanout services
              performed prior to your installation date.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>
                <strong className="text-white">Network Lead Fee:</strong> A{" "}
                <strong className="text-white">10% network lead fee</strong> is applied to all
                Upsell Services facilitated through the Platform. This fee is included in the
                quoted price of the upsell item.
              </li>
              <li>
                <strong className="text-white">Upsell Deposit:</strong> A 50% deposit may be
                required at the time of confirming an Upsell Service. The remaining balance is
                collected at the time the service is performed.
              </li>
              <li>
                <strong className="text-white">Applicable Services:</strong> This fee applies to
                all Platform-facilitated upsell items including, but not limited to: garage cleanout
                services, organizational add-ons, and any additional services offered through the
                Platform&apos;s automated upsell system.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">3. Cancellation and Refunds</h2>
            <p className="mb-4 text-stone-300 leading-relaxed">
              We understand plans can change. Our cancellation policy is as follows:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>
                <strong className="text-white">More than 48 hours before installation:</strong> Full
                deposit refund available upon request.
              </li>
              <li>
                <strong className="text-white">Less than 48 hours before installation:</strong>{" "}
                Deposit may be forfeited or applied to a rescheduled installation date.
              </li>
              <li>
                <strong className="text-white">After installation begins:</strong> No refunds are
                available once work has commenced.
              </li>
            </ul>
            <p className="mt-4 text-stone-300 leading-relaxed">
              To request a cancellation or reschedule, please contact your installer directly or
              email us at{" "}
              <a
                href={`mailto:${siteConfig.supportEmail}`}
                className="text-yellow-400 hover:text-yellow-300"
              >
                {siteConfig.supportEmail}
              </a>
              .
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">4. Independent Installers</h2>
            <p className="mb-4 text-stone-300 leading-relaxed">
              Installers on our platform are independent contractors, not employees of{" "}
              {siteConfig.name}. While we vet our installer partners and provide them with
              standardized materials and guidelines:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>
                Each installer is responsible for the quality of their own work and customer service.
              </li>
              <li>
                {siteConfig.name} is not liable for any damages, delays, or disputes arising from
                installer performance.
              </li>
              <li>
                We encourage customers to communicate directly with their assigned installer
                regarding scheduling and installation details.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">5. Warranty</h2>
            <p className="mb-4 text-stone-300 leading-relaxed">
              All installations come with a <strong className="text-white">30-day warranty</strong>{" "}
              covering defects in workmanship. This warranty includes:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>Structural issues with the installed storage system</li>
              <li>Defective hardware or materials provided by the installer</li>
              <li>Installation errors that affect functionality</li>
            </ul>
            <p className="mt-4 text-stone-300 leading-relaxed">
              The warranty does not cover damage caused by misuse, overloading beyond rated
              capacity, or modifications made after installation.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">6. User Accounts</h2>
            <p className="text-stone-300 leading-relaxed">
              If you create an account on our platform (as a customer or installer), you are
              responsible for maintaining the confidentiality of your login credentials and for all
              activities that occur under your account. You agree to notify us immediately of any
              unauthorized use.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">7. Privacy</h2>
            <p className="text-stone-300 leading-relaxed">
              Your privacy is important to us. By using our services, you consent to the collection
              and use of your information as described in our{" "}
              <a href="/privacy" className="text-yellow-400 hover:text-yellow-300 underline">
                Privacy Policy
              </a>
              . We collect only the information necessary to process orders and facilitate
              communication between customers and installers.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">8. Limitation of Liability</h2>
            <p className="text-stone-300 leading-relaxed">
              To the maximum extent permitted by law, {siteConfig.name} and its affiliates shall not
              be liable for any indirect, incidental, special, consequential, or punitive damages
              arising from your use of the platform or services. Our total liability shall not
              exceed the amount of fees paid by you to us in the twelve (12) months preceding the
              claim.
            </p>
          </section>

          {/* Section 9 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">9. Changes to Terms</h2>
            <p className="text-stone-300 leading-relaxed">
              We reserve the right to modify these Terms of Service at any time. Changes will be
              effective immediately upon posting to this page. Your continued use of the platform
              after changes are posted constitutes acceptance of the modified terms.
            </p>
          </section>

          {/* Section 10 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">10. Contact Us</h2>
            <p className="text-stone-300 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at{" "}
              <a
                href={`mailto:${siteConfig.supportEmail}`}
                className="text-yellow-400 hover:text-yellow-300"
              >
                {siteConfig.supportEmail}
              </a>
              .
            </p>
          </section>
        </div>

        {/* Related Links */}
        <div className="mt-12 flex gap-4">
          <a
            href="/privacy"
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 p-4 text-center transition-colors hover:border-slate-700"
          >
            <p className="text-sm font-semibold text-white">Privacy Policy</p>
            <p className="mt-1 text-xs text-stone-500">View our policy</p>
          </a>
          <a
            href="/design"
            className="flex-1 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-center transition-colors hover:bg-yellow-400/20"
          >
            <p className="text-sm font-semibold text-yellow-400">Start Designing</p>
            <p className="mt-1 text-xs text-stone-500">Build your system</p>
          </a>
        </div>
      </main>
    </div>
  );
}
