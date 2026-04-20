import { ArrowLeft } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Privacy Policy — Data Practices for The Storage-Network
// ═══════════════════════════════════════════════════════════════════════════

export const metadata = {
  title: "Privacy Policy | Storage Network",
  description:
    "How Storage Network collects, uses, and protects your data. Covers installer accounts, customer booking information, payment processing via Stripe, and cookie usage.",
  alternates: {
    canonical: "/legal/privacy",
  },
};

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="prose prose-invert prose-sm max-w-none">
          <p className="text-xs text-stone-500">
            Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">1. Introduction</h2>
          <p>
            The Storage-Network (&quot;Platform,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;),
            operated by Storage-Network.app, is committed to protecting your privacy. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your information when you use our
            website and services.
          </p>
          <p>
            By using the Platform, you consent to the data practices described in this policy. If you
            do not agree with this policy, please do not use our services.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">2. Information We Collect</h2>

          <h3 className="mt-4 text-base font-semibold text-white">For Customers</h3>
          <p>When you request a quote or book an installation, we collect:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Contact Information:</strong> Name, email address, phone number</li>
            <li><strong>Location Information:</strong> Service address, city, state, ZIP code</li>
            <li><strong>Project Details:</strong> Garage dimensions, storage configuration preferences</li>
            <li><strong>Payment Information:</strong> Processed securely through Stripe (we do not store
              full credit card numbers on our servers)</li>
            <li><strong>Communication Records:</strong> Messages exchanged through the Platform</li>
          </ul>

          <h3 className="mt-4 text-base font-semibold text-white">For Installers</h3>
          <p>When you join as an Installer, we collect:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account Information:</strong> Name, email address, phone number</li>
            <li><strong>Business Information:</strong> Business name, trade name (DBA), service area</li>
            <li><strong>Profile Information:</strong> Profile photo, business logo</li>
            <li><strong>Financial Information:</strong> Bank account details and tax information
              (collected and processed by Stripe Connect)</li>
            <li><strong>Performance Data:</strong> Job history, customer ratings, response times</li>
          </ul>

          <h3 className="mt-4 text-base font-semibold text-white">Automatically Collected Information</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Device Information:</strong> Browser type, operating system, device identifiers</li>
            <li><strong>Usage Data:</strong> Pages visited, time spent on pages, click patterns</li>
            <li><strong>IP Address:</strong> For security and approximate location purposes</li>
            <li><strong>Cookies:</strong> See Section 7 for details on our cookie practices</li>
          </ul>

          <h2 className="mt-8 text-lg font-bold text-white">3. How We Use Your Information</h2>
          <p>We use collected information for the following purposes:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Service Delivery:</strong> To connect Customers with Installers, process bookings,
              and facilitate installations</li>
            <li><strong>Payment Processing:</strong> To process deposits, final payments, and Installer payouts</li>
            <li><strong>Communications:</strong> To send booking confirmations, appointment reminders,
              and service-related notifications</li>
            <li><strong>Platform Improvement:</strong> To analyze usage patterns and improve our services</li>
            <li><strong>Customer Support:</strong> To respond to inquiries and resolve issues</li>
            <li><strong>Marketing:</strong> To send promotional materials (with your consent, where required)</li>
            <li><strong>Legal Compliance:</strong> To comply with applicable laws and regulations</li>
          </ul>

          <h2 className="mt-8 text-lg font-bold text-white">4. Payment Processing &amp; Stripe</h2>
          <p>
            All payment processing is handled by <strong>Stripe, Inc.</strong>, a PCI-DSS compliant
            payment processor. When you make a payment or receive payouts:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your payment card details are transmitted directly to Stripe&apos;s secure servers</li>
            <li>We receive only a tokenized reference and last four digits of your card</li>
            <li>Installer payout information is stored and processed by Stripe Connect</li>
            <li>Stripe&apos;s privacy policy governs their handling of your payment data: {" "}
              <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer"
                className="text-yellow-400 hover:underline">stripe.com/privacy</a>
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-bold text-white">5. Information Sharing &amp; Disclosure</h2>
          <p>We may share your information in the following circumstances:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Between Customers and Installers:</strong> Contact and project information
              necessary to complete installations</li>
            <li><strong>Service Providers:</strong> With third-party vendors who assist in operating
              our Platform (e.g., Stripe for payments, Brevo for email communications, Supabase for
              data storage)</li>
            <li><strong>Legal Requirements:</strong> When required by law, subpoena, or legal process</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale
              of assets</li>
            <li><strong>Protection of Rights:</strong> To protect the safety, rights, or property of
              the Platform, our users, or the public</li>
          </ul>
          <p>
            <strong>We do not sell your personal information to third parties for marketing purposes.</strong>
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">6. Data Retention</h2>
          <p>We retain your information for as long as necessary to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide our services and maintain your account</li>
            <li>Comply with legal obligations (e.g., tax records for 7 years)</li>
            <li>Resolve disputes and enforce our agreements</li>
            <li>Maintain warranty records (30-day workmanship warranty period plus reasonable buffer)</li>
          </ul>
          <p>
            You may request deletion of your account and personal data by contacting us. Some information
            may be retained as required by law or for legitimate business purposes.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">7. Cookies &amp; Tracking Technologies</h2>
          <p>We use cookies and similar technologies for:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Essential Cookies:</strong> Required for Platform functionality (authentication,
              session management)</li>
            <li><strong>Installer Attribution:</strong> We use a 30-day cookie to track which Installer
              referred a Customer, ensuring proper commission attribution</li>
            <li><strong>Analytics:</strong> To understand how users interact with our Platform</li>
          </ul>
          <p>
            You can control cookies through your browser settings. Disabling certain cookies may affect
            Platform functionality.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">8. Data Security</h2>
          <p>We implement industry-standard security measures including:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>SSL/TLS encryption for all data transmission</li>
            <li>Secure, encrypted database storage (Supabase with row-level security)</li>
            <li>Regular security audits and vulnerability assessments</li>
            <li>Limited employee access to personal information</li>
            <li>PCI-DSS compliant payment processing through Stripe</li>
          </ul>
          <p>
            While we strive to protect your information, no method of transmission over the Internet
            is 100% secure. We cannot guarantee absolute security.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">9. Your Rights &amp; Choices</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Correction:</strong> Update inaccurate or incomplete information</li>
            <li><strong>Deletion:</strong> Request deletion of your personal data</li>
            <li><strong>Portability:</strong> Receive your data in a portable format</li>
            <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
            <li><strong>Withdraw Consent:</strong> Where processing is based on consent</li>
          </ul>
          <p>
            To exercise these rights, contact us at{" "}
            <a href="mailto:privacy@storage-network.app" className="text-yellow-400 hover:underline">
              privacy@storage-network.app
            </a>.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">10. California Privacy Rights</h2>
          <p>
            California residents have additional rights under the California Consumer Privacy Act (CCPA):
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Right to know what personal information is collected and how it&apos;s used</li>
            <li>Right to delete personal information</li>
            <li>Right to opt-out of the sale of personal information (we do not sell personal data)</li>
            <li>Right to non-discrimination for exercising privacy rights</li>
          </ul>

          <h2 className="mt-8 text-lg font-bold text-white">11. Children&apos;s Privacy</h2>
          <p>
            Our Platform is not intended for children under 18 years of age. We do not knowingly collect
            personal information from children. If you believe we have collected information from a child,
            please contact us immediately.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">12. Third-Party Links</h2>
          <p>
            Our Platform may contain links to third-party websites. We are not responsible for the
            privacy practices of these sites. We encourage you to review the privacy policies of any
            third-party sites you visit.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">13. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes will be communicated
            via email or a prominent notice on the Platform. The &quot;Last updated&quot; date at the
            top indicates when this policy was last revised.
          </p>

          <h2 className="mt-8 text-lg font-bold text-white">14. Contact Us</h2>
          <p>
            For questions, concerns, or requests regarding this Privacy Policy or our data practices,
            contact us at:
          </p>
          <div className="mt-2 rounded-lg bg-slate-900 p-4">
            <p className="text-sm">
              <strong className="text-white">Storage-Network.app</strong><br />
              Email:{" "}
              <a href="mailto:privacy@storage-network.app" className="text-yellow-400 hover:underline">
                privacy@storage-network.app
              </a><br />
              General Support:{" "}
              <a href="mailto:support@storage-network.app" className="text-yellow-400 hover:underline">
                support@storage-network.app
              </a>
            </p>
          </div>

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
