import { ArrowLeft } from "lucide-react";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Privacy Policy Page
// ═══════════════════════════════════════════════════════════════════════════

export const metadata = {
  title: "Privacy Policy | Storage Network",
  description: "Privacy Policy for the Storage Network platform",
};

export default function PrivacyPage() {
  const lastUpdated = "May 12, 2026";

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
        <h1 className="mb-2 text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="mb-8 text-sm text-stone-500">Last updated: {lastUpdated}</p>

        <div className="prose prose-invert prose-stone max-w-none">
          {/* Introduction */}
          <section className="mb-8">
            <p className="text-stone-300 leading-relaxed">
              At {siteConfig.name}, we take your privacy seriously. This Privacy Policy explains how
              we collect, use, disclose, and safeguard your information when you use our platform.
              Please read this policy carefully.
            </p>
          </section>

          {/* Section 1 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">1. Information We Collect</h2>
            <p className="mb-4 text-stone-300 leading-relaxed">
              We collect information you provide directly to us when using our services:
            </p>
            <h3 className="mb-2 mt-4 text-lg font-semibold text-white">Personal Information</h3>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>Name and contact information (email address, phone number)</li>
              <li>Billing and shipping address</li>
              <li>Payment information (processed securely through Stripe)</li>
              <li>Account credentials (for installer accounts)</li>
            </ul>
            <h3 className="mb-2 mt-4 text-lg font-semibold text-white">Order Information</h3>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>Storage system configurations and preferences</li>
              <li>Installation scheduling details</li>
              <li>Communication history with installers</li>
            </ul>
            <h3 className="mb-2 mt-4 text-lg font-semibold text-white">Automatically Collected</h3>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>Device information (browser type, operating system, screen resolution, full
                user-agent string)</li>
              <li>
                <strong className="text-white">IP address:</strong> We collect and retain the IP
                address of every request to the platform. We use it for security (rate-limiting,
                abuse detection, fraud prevention), to derive approximate geographic location
                (city / region / country), and to identify suspicious access patterns including
                competitive reconnaissance and automated scraping. Public-page IP records are
                retained for up to 24 months; IPs tied to account activity are retained for the
                life of the account plus a reasonable buffer.
              </li>
              <li>Usage data (pages visited, time on page, click patterns, navigation paths,
                session duration)</li>
              <li>Referrer URL and any UTM tracking parameters present in the URL</li>
              <li>Persistent visitor and session identifiers stored in your browser&apos;s
                localStorage and sessionStorage</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
            <p className="mt-3 text-sm text-stone-400">
              Some of the above (IP address, persistent visitor identifier, device fingerprint) may
              be considered personal information under the GDPR, CCPA, and similar privacy laws. We
              process it under our legitimate interest in operating a secure platform and protecting
              it against fraud, abuse, and unauthorized competitive intelligence gathering. You may
              request access to or deletion of this information as described in Section 7.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">2. How We Use Your Information</h2>
            <p className="mb-4 text-stone-300 leading-relaxed">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>Process and fulfill your orders</li>
              <li>Connect you with qualified installers in your area</li>
              <li>Send order confirmations, updates, and receipts</li>
              <li>Process payments securely</li>
              <li>Provide customer support</li>
              <li>Send promotional communications (with your consent)</li>
              <li>Improve our platform and services</li>
              <li>Detect and prevent fraud, automated scraping, denial-of-service attempts, and
                unauthorized competitive intelligence gathering against the platform and its users</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">3. Information Sharing</h2>
            <p className="mb-4 text-stone-300 leading-relaxed">
              We share your information only in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>
                <strong className="text-white">With Installers:</strong> We share your name, contact
                information, address, and order details with the installer assigned to your job so
                they can complete your installation.
              </li>
              <li>
                <strong className="text-white">Service Providers:</strong> We use third-party
                services for payment processing (Stripe), email delivery (Resend), and hosting
                (Vercel). These providers only access data necessary to perform their services.
              </li>
              <li>
                <strong className="text-white">Legal Requirements:</strong> We may disclose
                information if required by law or in response to valid legal requests.
              </li>
              <li>
                <strong className="text-white">Business Transfers:</strong> In the event of a
                merger, acquisition, or sale of assets, your information may be transferred.
              </li>
            </ul>
            <p className="mt-4 text-stone-300 leading-relaxed">
              <strong className="text-white">We do not sell your personal information</strong> to
              third parties for marketing purposes.
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">4. Payment Security</h2>
            <p className="text-stone-300 leading-relaxed">
              All payment transactions are processed through Stripe, a PCI-DSS compliant payment
              processor. We never store your full credit card number, expiration date, or CVV on our
              servers. Stripe handles all sensitive payment data using industry-standard encryption
              and security practices.
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">5. Cookies and Tracking</h2>
            <p className="mb-4 text-stone-300 leading-relaxed">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>Keep you signed in to your account</li>
              <li>Remember your preferences and settings</li>
              <li>Track referrals from installer partner links</li>
              <li>Analyze how our platform is used</li>
            </ul>
            <p className="mt-4 text-stone-300 leading-relaxed">
              You can control cookies through your browser settings. Note that disabling cookies may
              affect the functionality of our platform.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">6. Data Retention</h2>
            <p className="text-stone-300 leading-relaxed">
              We retain your personal information for as long as necessary to fulfill the purposes
              outlined in this policy, unless a longer retention period is required by law. Order
              records are kept for accounting and warranty purposes. You may request deletion of
              your account and associated data by contacting us.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">7. Your Rights</h2>
            <p className="mb-4 text-stone-300 leading-relaxed">
              Depending on your location, you may have certain rights regarding your personal
              information:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-stone-300">
              <li>
                <strong className="text-white">Access:</strong> Request a copy of the personal
                information we hold about you.
              </li>
              <li>
                <strong className="text-white">Correction:</strong> Request correction of inaccurate
                or incomplete information.
              </li>
              <li>
                <strong className="text-white">Deletion:</strong> Request deletion of your personal
                information, subject to legal retention requirements.
              </li>
              <li>
                <strong className="text-white">Opt-out:</strong> Unsubscribe from marketing
                communications at any time.
              </li>
            </ul>
            <p className="mt-4 text-stone-300 leading-relaxed">
              To exercise these rights, contact us at{" "}
              <a
                href={`mailto:${siteConfig.supportEmail}`}
                className="text-yellow-400 hover:text-yellow-300"
              >
                {siteConfig.supportEmail}
              </a>
              .
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">8. Children&apos;s Privacy</h2>
            <p className="text-stone-300 leading-relaxed">
              Our platform is not intended for children under 18 years of age. We do not knowingly
              collect personal information from children. If you believe we have collected
              information from a child, please contact us immediately.
            </p>
          </section>

          {/* Section 9 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">9. Security</h2>
            <p className="text-stone-300 leading-relaxed">
              We implement appropriate technical and organizational measures to protect your
              personal information against unauthorized access, alteration, disclosure, or
              destruction. However, no method of transmission over the Internet is 100% secure. We
              cannot guarantee absolute security but strive to protect your data using
              industry-standard practices.
            </p>
          </section>

          {/* Section 10 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">10. Changes to This Policy</h2>
            <p className="text-stone-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new policy on this page and updating the &quot;Last updated&quot; date.
              Your continued use of our platform after changes are posted constitutes acceptance of
              the updated policy.
            </p>
          </section>

          {/* Section 11 */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-yellow-400">11. Contact Us</h2>
            <p className="text-stone-300 leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please
              contact us at{" "}
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
            href="/terms"
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 p-4 text-center transition-colors hover:border-slate-700"
          >
            <p className="text-sm font-semibold text-white">Terms of Service</p>
            <p className="mt-1 text-xs text-stone-500">View our terms</p>
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
