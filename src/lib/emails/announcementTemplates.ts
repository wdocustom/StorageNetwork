import { sendTransactionalEmail, emailShell, type SendEmailResult } from "./core";
import { getAppUrl } from "@/lib/url-helper";

export interface FeatureAnnouncementData {
  installerName: string;
  dashboardUrl: string;
  guidesUrl: string;
}

export async function sendFeatureAnnouncement(
  email: string,
  data: FeatureAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, dashboardUrl, guidesUrl } = data;

  const html = emailShell(
    "New Platform Features",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      We&rsquo;ve been building. Here&rsquo;s a quick rundown of everything new on your Storage Network platform &mdash;
      all designed to help you close more jobs and deliver a better experience to your customers.
    </p>

    <!-- Feature 1: Open Shelving -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">New &mdash; Open Shelving Units</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Your customers can now add <strong>standalone open shelving units</strong> directly in the 3D configurator.
        Available in 4&rsquo;, 5&rsquo;, and 6&rsquo; widths with short and tall height options &mdash; same 30&quot; depth
        as tote organizers so they sit flush on the wall. Plywood top and shelves included in every unit.
      </p>
    </div>

    <!-- Feature 2: Organizer Customization -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">New &mdash; Organizer Customization</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Customers can now customize individual tote organizer bays with <strong>plywood shelves</strong>,
        <strong>plywood doors</strong> with concealed Blum hinges, <strong>side panels</strong>, and
        <strong>rail removal</strong> &mdash; all priced per-addon. Plus a full <strong>paint system</strong>
        for frames, doors, and panels. Every addon flows through to the shopping list and cut plans.
      </p>
    </div>

    <!-- Feature 3: Toggle Controls -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Full Control &mdash; Your Settings</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Every new feature can be <strong>toggled on or off</strong> from your Profile &amp; Settings page.
        Don&rsquo;t want to offer open shelving? Disable it. Want to set your own addon pricing? Override
        every line item. You control exactly what your customers see on your branded design page.
      </p>
      <div style="margin-top:16px;">
        <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">
          Open Settings &rarr;
        </a>
      </div>
    </div>

    <!-- Feature 4: Tutorial Videos -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Guides &amp; Training Videos</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
        The <strong>Guides page</strong> now has step-by-step tutorial videos, installation checklists,
        and a social media playbook to help you market your builds. Whether you&rsquo;re a first-time
        installer or scaling your crew, everything you need is in one place.
      </p>
      <div style="margin-top:16px;">
        <a href="${guidesUrl}" style="display:inline-block;background-color:transparent;color:#facc15;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;border:1px solid #facc15;">
          View Guides &rarr;
        </a>
      </div>
    </div>

    <!-- Coming Soon: Auto-Marketing -->
    <div style="background:linear-gradient(135deg,#0f172a,#1a1a2e);border-radius:12px;padding:20px 24px;margin-bottom:24px;border:1px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">&#9889; Coming Soon &mdash; Pro Subscribers</p>
      <p style="margin:0 0 8px;color:#e2e8f0;font-size:16px;font-weight:700;">Auto-Marketing Agent</p>
      <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.7;">
        We&rsquo;re rolling out a <strong style="color:#e2e8f0;">state-of-the-art AI marketing agent</strong> exclusively
        for Pro subscribers. This system will automatically generate informative pages showcasing your
        portfolio, services, and service area &mdash; complete with SEO optimization and rich content.
        No effort on your end. The agent handles everything, creating professional marketing pages that
        drive traffic and leads directly to your profile. Stay tuned.
      </p>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:14px;">
      Thanks for being part of the network. We&rsquo;re building this for you.
    </p>
    <p style="margin:12px 0 0;color:#64748b;font-size:13px;">
      &mdash; The Storage Network Team
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "New Features: Open Shelving, Organizer Customization & More",
    html,
  });
}

export interface BountyAnnouncementData {
  installerName: string;
  dashboardUrl: string;
  referralsUrl: string;
}

export async function sendBountyAnnouncementEmail(
  email: string,
  data: BountyAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, dashboardUrl, referralsUrl } = data;

  const html = emailShell(
    "Earn Money While You Sleep",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Did you know you can <strong style="color:#facc15;">earn passive income</strong> just by sharing your
      Storage Network link? Every installer on the platform has a built-in referral system that pays you
      real money &mdash; even when the customer is nowhere near your service area.
    </p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Here&rsquo;s the short version: <strong style="color:#e2e8f0;">share your link, and if someone outside
      your area books a job, you get paid.</strong> That&rsquo;s it. Zero extra work on your end.
    </p>

    <!-- How It Works -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 12px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">How It Works &mdash; 3 Simple Steps</p>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;padding:8px 12px 8px 0;width:32px;">
            <div style="background:#422006;color:#facc15;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:800;">1</div>
          </td>
          <td style="vertical-align:top;padding:8px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;font-weight:700;">Share your link anywhere</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
              Post it on Facebook, TikTok, Instagram, your website, even text it to friends. Your link
              works <strong>nationwide</strong> &mdash; not just in your service area. Think of it like
              dropping a fishing line that covers the whole country.
            </p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:8px 12px 8px 0;width:32px;">
            <div style="background:#422006;color:#facc15;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:800;">2</div>
          </td>
          <td style="vertical-align:top;padding:8px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;font-weight:700;">Customer configures &amp; books</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
              Someone clicks your link and designs their garage storage. If they&rsquo;re outside your
              area, we automatically connect them with a local installer near them. You don&rsquo;t
              have to do anything &mdash; the handoff is instant and seamless.
            </p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:8px 12px 8px 0;width:32px;">
            <div style="background:#422006;color:#facc15;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:800;">3</div>
          </td>
          <td style="vertical-align:top;padding:8px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;font-weight:700;">You get paid automatically</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
              When the customer pays their deposit, <strong style="color:#facc15;">30% of that deposit
              goes straight to your Stripe account</strong>. Minimum payout is $15 per referral.
              No invoicing, no chasing payments &mdash; it just shows up in your account.
            </p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Sample Earnings -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 12px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">What Could You Earn?</p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;line-height:1.6;">
        Here&rsquo;s what real referral bounties look like. These are based on typical deposit amounts:
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr style="border-bottom:1px solid #334155;">
          <td style="padding:10px 8px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Job Type</td>
          <td style="padding:10px 8px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:center;">Deposit</td>
          <td style="padding:10px 8px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Your Bounty</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">Small build</td>
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;text-align:center;">$50</td>
          <td style="padding:10px 8px;color:#16a34a;font-size:14px;font-weight:800;text-align:right;">$15.00</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">Mid-size garage</td>
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;text-align:center;">$150</td>
          <td style="padding:10px 8px;color:#16a34a;font-size:14px;font-weight:800;text-align:right;">$45.00</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">Full garage build</td>
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;text-align:center;">$300</td>
          <td style="padding:10px 8px;color:#16a34a;font-size:14px;font-weight:800;text-align:right;">$90.00</td>
        </tr>
        <tr>
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">Premium custom job</td>
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;text-align:center;">$500</td>
          <td style="padding:10px 8px;color:#facc15;font-size:14px;font-weight:800;text-align:right;">$150.00</td>
        </tr>
      </table>

      <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
        Just <strong>5 referrals a month</strong> at an average deposit of $200 = <strong style="color:#facc15;">$300/month in passive income</strong>.
        That&rsquo;s money you earn while you&rsquo;re on the job, eating dinner, or sleeping.
      </p>
    </div>

    <!-- Dashboard Snapshot -->
    <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:16px;">
      <div style="background:#0f172a;padding:12px 16px;border-bottom:1px solid #334155;">
        <p style="margin:0;color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">&#128200; Your Referral Dashboard</p>
      </div>
      <div style="padding:16px;">
        <!-- Stats row -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr>
            <td style="text-align:center;padding:8px;background:#1e293b;border-radius:8px;border:1px solid #334155;width:33%;">
              <p style="margin:0;color:#facc15;font-size:20px;font-weight:900;">$360</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Earned</p>
            </td>
            <td style="width:8px;"></td>
            <td style="text-align:center;padding:8px;background:#1e293b;border-radius:8px;border:1px solid #334155;width:33%;">
              <p style="margin:0;color:#10b981;font-size:20px;font-weight:900;">6</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Paid</p>
            </td>
            <td style="width:8px;"></td>
            <td style="text-align:center;padding:8px;background:#1e293b;border-radius:8px;border:1px solid #334155;width:33%;">
              <p style="margin:0;color:#f59e0b;font-size:20px;font-weight:900;">2</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Pending</p>
            </td>
          </tr>
        </table>
        <!-- Sample referral rows -->
        <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 12px;margin-bottom:6px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <p style="margin:0;color:#e2e8f0;font-size:12px;font-weight:600;">Austin, TX</p>
                <p style="margin:2px 0 0;color:#64748b;font-size:10px;">Mar 8 &bull; $1,200 job</p>
              </td>
              <td style="text-align:right;vertical-align:middle;">
                <span style="background:#052e16;color:#10b981;font-size:10px;font-weight:800;padding:3px 8px;border-radius:10px;">&#10003; +$45</span>
              </td>
            </tr>
          </table>
        </div>
        <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 12px;margin-bottom:6px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <p style="margin:0;color:#e2e8f0;font-size:12px;font-weight:600;">Denver, CO</p>
                <p style="margin:2px 0 0;color:#64748b;font-size:10px;">Mar 6 &bull; $2,400 job</p>
              </td>
              <td style="text-align:right;vertical-align:middle;">
                <span style="background:#052e16;color:#10b981;font-size:10px;font-weight:800;padding:3px 8px;border-radius:10px;">&#10003; +$90</span>
              </td>
            </tr>
          </table>
        </div>
        <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 12px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <p style="margin:0;color:#e2e8f0;font-size:12px;font-weight:600;">Phoenix, AZ</p>
                <p style="margin:2px 0 0;color:#64748b;font-size:10px;">Mar 10 &bull; $1,800 job</p>
              </td>
              <td style="text-align:right;vertical-align:middle;">
                <span style="background:#422006;color:#f59e0b;font-size:10px;font-weight:800;padding:3px 8px;border-radius:10px;">&#9719; ~$54</span>
              </td>
            </tr>
          </table>
        </div>
      </div>
      <div style="background:#0f172a;padding:8px 16px;border-top:1px solid #334155;text-align:center;">
        <p style="margin:0;color:#64748b;font-size:9px;font-style:italic;">Sample data &mdash; this is what your referral dashboard looks like</p>
      </div>
    </div>

    <!-- The Real Value -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 12px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Why This Matters</p>
      <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Between jobs, during slow weeks, or even on vacation &mdash; your link is always working for you.
        Every post you make, every video you upload, every link you share has the potential to earn you money
        from anywhere in the country.
      </p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
        You&rsquo;re already an expert at garage storage. Now that expertise pays you twice &mdash;
        once for your own jobs, and again for every customer your content reaches nationwide.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${referralsUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View My Referrals &rarr;
      </a>
    </div>

    <!-- Auto-Marketing Teaser -->
    <div style="background:linear-gradient(135deg,#0f172a,#1a1a2e);border-radius:12px;padding:20px 24px;margin-bottom:24px;border:1px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">&#9889; Coming Soon &mdash; Auto-Marketing Agent</p>
      <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.7;">
        We&rsquo;re building an <strong style="color:#e2e8f0;">AI-powered marketing system</strong> exclusively for
        Pro subscribers. It will automatically create SEO-optimized pages showcasing your portfolio,
        services, and service area &mdash; driving traffic and leads to your profile with zero effort
        on your end. Pair that with the referral system and your passive income potential goes through the roof.
        More details coming soon.
      </p>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:14px;">
      Start sharing your link today. The more people who see it, the more you earn.
    </p>
    <p style="margin:12px 0 0;color:#64748b;font-size:13px;">
      &mdash; The Storage Network Team
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "You're Leaving Money on the Table — Here's How Referrals Pay You",
    html,
  });
}

export interface OverheadAnnouncementData {
  installerName: string;
  dashboardUrl: string;
  marketingUrl: string;
  configuratorSlug?: string;
}

export async function sendOverheadAnnouncementEmail(
  email: string,
  data: OverheadAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, dashboardUrl, marketingUrl, configuratorSlug } = data;
  const baseUrl = getAppUrl();
  const img1 = `${baseUrl}/images/Overhead-Storage-1.png`;
  const img2 = `${baseUrl}/images/Overhead-Storage-2.png`;
  const configuratorUrl = configuratorSlug ? `${baseUrl}/design/${configuratorSlug}` : dashboardUrl;

  const html = emailShell(
    "Overhead Ceiling Storage Is Live",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 8px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Quick question &mdash; when you&rsquo;re in a customer&rsquo;s garage, do you ever look up and think
      <strong style="color:#e2e8f0;">&ldquo;that&rsquo;s a lot of wasted space&rdquo;</strong>?
    </p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Your customers are thinking the same thing. Now you can capitalize on it.
    </p>

    <!-- Hero: Overhead Storage -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Now Live &mdash; Overhead Ceiling Storage</p>
      <p style="margin:0 0 16px;color:#e2e8f0;font-size:18px;font-weight:700;line-height:1.4;">
        Turn dead ceiling space into organized, accessible storage.
      </p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.7;">
        The overhead system is a <strong style="color:#e2e8f0;">4-layer build</strong> that lags directly to ceiling joists:
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="vertical-align:top;padding:6px 12px 6px 0;width:28px;">
            <div style="background:#422006;color:#facc15;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;">1</div>
          </td>
          <td style="vertical-align:top;padding:6px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;"><strong>2&times;4 Nailers</strong> &mdash; lag-screwed to joists with washers</p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:6px 12px 6px 0;width:28px;">
            <div style="background:#422006;color:#facc15;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;">2</div>
          </td>
          <td style="vertical-align:top;padding:6px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;"><strong>Plywood rail strips</strong> &mdash; screwed to the nailers</p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:6px 12px 6px 0;width:28px;">
            <div style="background:#422006;color:#facc15;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;">3</div>
          </td>
          <td style="vertical-align:top;padding:6px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;"><strong>Slide-in tote trays</strong> &mdash; same 27-gallon HDX totes your customers already know</p>
          </td>
        </tr>
      </table>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
        It&rsquo;s a dead-simple build. Lumber, plywood, lag bolts. No fancy hardware, no expensive brackets.
        If you can build the tote racks, you can build this. The material cost is low and the perceived
        value to the customer is <strong style="color:#e2e8f0;">massive</strong> &mdash; they&rsquo;re literally
        getting storage space that didn&rsquo;t exist before.
      </p>
    </div>

    <!-- 3D Snapshots -->
    <div style="margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:49%;padding:0 4px 0 0;">
            <img src="${img1}" alt="Overhead storage 3D view" style="width:100%;border-radius:10px;border:1px solid #334155;display:block;" />
          </td>
          <td style="width:49%;padding:0 0 0 4px;">
            <img src="${img2}" alt="Overhead storage installed view" style="width:100%;border-radius:10px;border:1px solid #334155;display:block;" />
          </td>
        </tr>
      </table>
      <p style="margin:8px 0 0;color:#64748b;font-size:11px;text-align:center;font-style:italic;">
        3D configurator previews &mdash; customers can design their overhead system in seconds
      </p>
    </div>

    <!-- Maximize Profit -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #10b981;">
      <p style="margin:0 0 6px;color:#10b981;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Maximize Profit Per Customer</p>
      <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Every customer who books tote racks is a warm lead for overhead storage. You&rsquo;re already
        in the garage. You already have the tools. One conversation turns a $500 job into a $800&ndash;$1,200 job.
      </p>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #334155;">
          <td style="padding:10px 8px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Build</td>
          <td style="padding:10px 8px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Typical Add-On Revenue</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">Tote racks only</td>
          <td style="padding:10px 8px;color:#94a3b8;font-size:14px;text-align:right;">&mdash;</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">+ Overhead ceiling storage</td>
          <td style="padding:10px 8px;color:#10b981;font-size:14px;font-weight:800;text-align:right;">+$200&ndash;$500</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">+ Open shelving unit</td>
          <td style="padding:10px 8px;color:#10b981;font-size:14px;font-weight:800;text-align:right;">+$150&ndash;$350</td>
        </tr>
        <tr>
          <td style="padding:10px 8px;color:#facc15;font-size:14px;font-weight:700;">Complete garage system</td>
          <td style="padding:10px 8px;color:#facc15;font-size:14px;font-weight:800;text-align:right;">+$350&ndash;$850</td>
        </tr>
      </table>
      <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
        That&rsquo;s real money from the same customer, the same appointment, and the same
        trip. The complete garage approach &mdash; walls, ceiling, and shelving &mdash; is your
        highest-margin upsell.
      </p>
    </div>

    <!-- The Complete Garage Pitch -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">The &ldquo;Complete Garage&rdquo; Pitch</p>
      <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Here&rsquo;s the play: <strong>start simple.</strong> You can be production-ready with just
        the tote rack offerings &mdash; that&rsquo;s the bread and butter, and it&rsquo;s all most
        customers need to get started.
      </p>
      <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.7;">
        But when a customer wants the full custom treatment &mdash; walls, ceiling, and shelving &mdash;
        you&rsquo;re now <strong>fully equipped to handle it.</strong> One installer, one visit, total
        garage transformation. That&rsquo;s the value proposition that sets you apart from every
        big-box shelving kit on the market.
      </p>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
        The configurator handles all the pricing and material lists automatically. Your customer
        designs their system, sees the price, and books &mdash; whether it&rsquo;s one tote rack
        or a floor-to-ceiling buildout.
      </p>
    </div>

    <!-- AI Script Generator Update -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Updated &mdash; AI Script Generator</p>
      <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Your <strong>Marketing tab</strong> is updated. The AI script generator now knows about
        all three product lines &mdash; tote racks, overhead ceiling storage, and open shelving.
      </p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.7;">
        New topic presets let you generate targeted posts in one tap:
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="padding:6px 8px;vertical-align:middle;">
            <span style="display:inline-block;background:#422006;color:#facc15;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">Overhead Storage</span>
          </td>
          <td style="padding:6px 8px;color:#94a3b8;font-size:13px;">&ldquo;Look up &mdash; that ceiling space is going to waste&rdquo;</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;vertical-align:middle;">
            <span style="display:inline-block;background:#422006;color:#facc15;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">Open Shelving</span>
          </td>
          <td style="padding:6px 8px;color:#94a3b8;font-size:13px;">&ldquo;Not everything fits in a tote&rdquo;</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;vertical-align:middle;">
            <span style="display:inline-block;background:#422006;color:#facc15;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">Full Garage System</span>
          </td>
          <td style="padding:6px 8px;color:#94a3b8;font-size:13px;">&ldquo;Walls + ceiling + shelving. One visit.&rdquo;</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;vertical-align:middle;">
            <span style="display:inline-block;background:#422006;color:#facc15;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">Holiday Prep</span>
          </td>
          <td style="padding:6px 8px;color:#94a3b8;font-size:13px;">&ldquo;Get decorations organized with overhead storage&rdquo;</td>
        </tr>
      </table>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;line-height:1.6;">
        Quick post templates for overhead and shelving are ready to copy &amp; paste, too. No AI needed &mdash;
        just tap, copy, and post.
      </p>
      <div style="text-align:center;">
        <a href="${marketingUrl}" style="display:inline-block;background-color:transparent;color:#facc15;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;border:1px solid #facc15;">
          Open Marketing Tab &rarr;
        </a>
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:24px 0;">
      <a href="${configuratorUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Open My Configurator &rarr;
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:14px;">
      Every garage has a ceiling. Start looking up &mdash; that&rsquo;s where the money is.
    </p>
    <p style="margin:12px 0 0;color:#64748b;font-size:13px;">
      &mdash; The Storage Network Team
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "Look Up \u2014 Overhead Ceiling Storage Is Live (Maximize Every Job)",
    html,
  });
}

export interface JigAnnouncementData {
  installerName: string;
  guidesUrl: string;
  profileUrl: string;
}

export async function sendJigAnnouncementEmail(
  email: string,
  data: JigAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, guidesUrl, profileUrl } = data;

  const html = emailShell(
    "New: Ladder Jig Plans + Custom Material Pricing",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 8px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Two updates this week that are going to save you time, money, and headaches.
    </p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      One helps you build faster. The other helps you <strong style="color:#e2e8f0;">buy smarter</strong>.
    </p>

    <!-- Hero: Jig Plans -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">New &mdash; Ladder Building Jig Plans</p>
      <p style="margin:0 0 16px;color:#e2e8f0;font-size:18px;font-weight:700;line-height:1.4;">
        Build consistent, square ladders every single time. $9.
      </p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.7;">
        If you&rsquo;ve ever had a ladder come out slightly racked, or spent 20 minutes fussing with
        clamps and a tape measure to get your rung spacing right &mdash; this jig eliminates all of that.
      </p>
      <p style="margin:0 0 16px;color:#e2e8f0;font-size:14px;line-height:1.7;">
        <strong>One-time build. Every ladder after that is drop-in, screw, done.</strong>
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="vertical-align:top;padding:6px 12px 6px 0;width:28px;">
            <div style="background:#422006;color:#facc15;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;">&#10003;</div>
          </td>
          <td style="vertical-align:top;padding:6px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;"><strong>Complete cut plan</strong> &mdash; every piece, every dimension, no guesswork</p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:6px 12px 6px 0;width:28px;">
            <div style="background:#422006;color:#facc15;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;">&#10003;</div>
          </td>
          <td style="vertical-align:top;padding:6px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;"><strong>Step-by-step build instructions</strong> &mdash; visual walkthrough with diagrams</p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:6px 12px 6px 0;width:28px;">
            <div style="background:#422006;color:#facc15;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;">&#10003;</div>
          </td>
          <td style="vertical-align:top;padding:6px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;"><strong>Materials list</strong> &mdash; one sheet of OSB, three 2&times;4s, and some screws</p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:6px 12px 6px 0;width:28px;">
            <div style="background:#422006;color:#facc15;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;">&#10003;</div>
          </td>
          <td style="vertical-align:top;padding:6px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;"><strong>Rung spacing marks</strong> &mdash; pre-calculated for perfect alignment every build</p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.7;">
        The jig costs about <strong style="color:#e2e8f0;">$20 in lumber</strong> to build and pays for itself on
        your very first rack. No more marking, measuring, and re-checking &mdash; just load the boards, align
        to the marks, and fasten. You&rsquo;ll cut your ladder assembly time in half.
      </p>
      <div style="text-align:center;">
        <a href="${guidesUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
          Get the Plans &mdash; $9 &rarr;
        </a>
      </div>
    </div>

    <!-- Custom Material Pricing -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:24px;margin-bottom:16px;border-left:3px solid #10b981;">
      <p style="margin:0 0 6px;color:#10b981;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">New &mdash; Custom Material Pricing</p>
      <p style="margin:0 0 16px;color:#e2e8f0;font-size:18px;font-weight:700;line-height:1.4;">
        Your prices. Your quantities. Your inventory &mdash; always accurate.
      </p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.7;">
        You can now enter your <strong style="color:#e2e8f0;">exact screw counts and pricing</strong> directly
        in your profile. Found a killer deal on a 25&nbsp;lb bucket of 1&#8209;5/8&quot; screws at the supply house?
        Punch in the quantity and what you paid &mdash; the system does the rest.
      </p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.7;">
        This feeds directly into the <strong style="color:#facc15;">Smart Inventory System</strong> &mdash; our flagship
        feature that tracks your material usage across every job. It knows exactly how many screws, boards,
        and sheets you have left, and it&rsquo;ll tell you <strong style="color:#e2e8f0;">before your next build</strong>
        if you need to restock.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="vertical-align:top;padding:8px 12px 8px 0;width:28px;">
            <div style="background:#064e3b;color:#10b981;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:14px;font-weight:800;">1</div>
          </td>
          <td style="vertical-align:top;padding:8px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.5;"><strong>Enter your bulk purchase</strong> &mdash; quantity and price per box or bucket</p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:8px 12px 8px 0;width:28px;">
            <div style="background:#064e3b;color:#10b981;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:14px;font-weight:800;">2</div>
          </td>
          <td style="vertical-align:top;padding:8px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.5;"><strong>System calculates per-unit cost</strong> &mdash; accurate material costs on every quote</p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:8px 12px 8px 0;width:28px;">
            <div style="background:#064e3b;color:#10b981;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:14px;font-weight:800;">3</div>
          </td>
          <td style="vertical-align:top;padding:8px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.5;"><strong>Inventory auto-depletes per job</strong> &mdash; you always know what you have and what you need</p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;line-height:1.6;">
        No more guessing if you have enough screws for tomorrow&rsquo;s build. No more emergency
        hardware store runs. The system stays ahead of your inventory so you can stay ahead of your schedule.
      </p>
      <div style="text-align:center;">
        <a href="${profileUrl}" style="display:inline-block;background-color:transparent;color:#10b981;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;border:1px solid #10b981;">
          Set Up My Material Pricing &rarr;
        </a>
      </div>
    </div>

    <!-- Bottom CTA -->
    <div style="text-align:center;margin:24px 0;">
      <p style="margin:0 0 12px;color:#94a3b8;font-size:14px;line-height:1.7;">
        Build faster. Buy smarter. Know your numbers.
      </p>
      <p style="margin:0 0 24px;color:#94a3b8;font-size:13px;line-height:1.6;">
        These two features work together &mdash; the jig speeds up your builds, and custom pricing ensures
        every quote reflects your <em>actual</em> costs. More margin, less waste.
      </p>
    </div>

    <p style="margin:0;color:#64748b;font-size:13px;">
      &mdash; The Storage Network Team
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "Build Faster, Price Smarter — Jig Plans + Custom Material Pricing",
    html,
  });
}

interface FeedbackCallData {
  installerName: string;
  bookingUrl: string;
}

export async function sendFeedbackCallInvite(
  email: string,
  data: FeedbackCallData
): Promise<SendEmailResult> {
  const { installerName, bookingUrl } = data;

  const html = emailShell(
    "Let\u2019s Connect",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${installerName},</p>

    <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.7;">
      I want to schedule a quick <strong style="color:#e2e8f0;">personal video call</strong> with you.
    </p>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      The goal is simple &mdash; walk through the platform together, make sure everything
      is working smoothly on your end, hear how things are going, and get your honest
      feedback on what you&rsquo;d like to see added or improved.
    </p>

    <!-- What we'll cover -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:24px;border-left:3px solid #facc15;">
      <p style="margin:0 0 12px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">On the Call</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;vertical-align:top;width:24px;">
            <span style="color:#facc15;font-size:14px;">&#10003;</span>
          </td>
          <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
            Full walkthrough of the platform &amp; your dashboard
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;vertical-align:top;width:24px;">
            <span style="color:#facc15;font-size:14px;">&#10003;</span>
          </td>
          <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
            Check in on how things are going for you
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;vertical-align:top;width:24px;">
            <span style="color:#facc15;font-size:14px;">&#10003;</span>
          </td>
          <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
            Your feedback &mdash; what&rsquo;s working, what&rsquo;s not
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;vertical-align:top;width:24px;">
            <span style="color:#facc15;font-size:14px;">&#10003;</span>
          </td>
          <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
            Feature requests &mdash; anything you&rsquo;d like to see built
          </td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      It&rsquo;s a 15&ndash;20 minute call, no pressure, no sales pitch. Just want to
      make sure the platform is actually helping you make money.
    </p>

    <!-- CTA Button -->
    <div style="text-align:center;margin:32px 0;">
      <a href="${bookingUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:0.3px;">
        Book Your Call &rarr;
      </a>
    </div>

    <p style="margin:0 0 8px;color:#64748b;font-size:13px;text-align:center;">
      Pick whatever time works best for you.
    </p>

    <div style="border-top:1px solid #334155;margin-top:32px;padding-top:24px;">
      <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.7;">
        Looking forward to hearing from you,
      </p>
      <p style="margin:8px 0 0;color:#e2e8f0;font-size:14px;font-weight:700;">
        The Storage Network Team
      </p>
    </div>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "Let\u2019s hop on a quick call \u2014 I want your feedback",
    html,
  });
}

interface InventoryAnnouncementData {
  installerName: string;
  dashboardUrl: string;
}

export async function sendInventoryAnnouncementEmail(
  email: string,
  data: InventoryAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, dashboardUrl } = data;

  const html = emailShell(
    "New Feature: Customer Tote Inventory",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${installerName},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      We just launched something that&rsquo;s going to set you apart from every other
      shelf builder in your area &mdash; and it&rsquo;s going to make your customers love you.
    </p>

    <!-- Feature Hero -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:24px;margin-bottom:20px;border:1px solid #facc15;text-align:center;">
      <p style="margin:0 0 8px;color:#facc15;font-size:22px;font-weight:900;">Customer Tote Inventory</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6;">
        AI-powered &bull; Always free for your customers &bull; Drives repeat business back to you
      </p>
    </div>

    <!-- How it works -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 10px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">How It Works</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.8;">
        After you complete a job, hit <strong>&ldquo;Create Inventory QR&rdquo;</strong> on the job ticket.
        The platform generates a unique QR code for each rack you built. Print the sticker, stick it
        on the rack, and your customer can scan it anytime to manage what&rsquo;s in their totes.
      </p>
    </div>

    <!-- AI Scanning -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 10px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">AI Photo Scanning</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.8;">
        Your customer opens a tote, snaps <strong>one photo</strong>, and our AI identifies every item inside &mdash;
        &ldquo;Christmas ornaments (12), string lights, tree skirt, wreath&rdquo; &mdash; all in seconds.
        One tap to add everything to their inventory. No typing. No hassle.
      </p>
    </div>

    <!-- Always Free -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 10px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Always Free for Your Customers</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.8;">
        There is <strong>no charge</strong> to your customer. Ever. The inventory system is a value-add
        that makes your installation memorable. Once they&rsquo;ve cataloged 20+ totes of holiday
        decorations, tools, and camping gear &mdash; they&rsquo;re never ripping out that shelf.
        And they&rsquo;ll tell their neighbors about it.
      </p>
    </div>

    <!-- Why it matters to YOU -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:24px;border-left:3px solid #facc15;">
      <p style="margin:0 0 10px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Why This Makes You Money</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.8;">
        Every inventory page has a soft &ldquo;Need More Storage?&rdquo; link that goes directly to
        <strong>your branded design page</strong>. When their totes fill up, when their neighbor asks
        &ldquo;where&rsquo;d you get that?&rdquo; &mdash; the lead comes back to <strong>you</strong> at the
        network rate. You don&rsquo;t have to ask for referrals. The platform does it for you.
      </p>
    </div>

    <!-- How to use it -->
    <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">To Get Started</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:8px 0;vertical-align:top;width:24px;">
          <span style="color:#facc15;font-size:14px;font-weight:bold;">1.</span>
        </td>
        <td style="padding:8px 0;color:#e2e8f0;font-size:14px;">
          Complete a job and mark it <strong>PAID</strong>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;vertical-align:top;width:24px;">
          <span style="color:#facc15;font-size:14px;font-weight:bold;">2.</span>
        </td>
        <td style="padding:8px 0;color:#e2e8f0;font-size:14px;">
          Tap <strong>&ldquo;Create Inventory QR&rdquo;</strong> on the job ticket
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;vertical-align:top;width:24px;">
          <span style="color:#facc15;font-size:14px;font-weight:bold;">3.</span>
        </td>
        <td style="padding:8px 0;color:#e2e8f0;font-size:14px;">
          Print the QR sticker and stick it on the rack
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;vertical-align:top;width:24px;">
          <span style="color:#facc15;font-size:14px;font-weight:bold;">4.</span>
        </td>
        <td style="padding:8px 0;color:#e2e8f0;font-size:14px;">
          Email the link to your customer (one-tap from the job ticket)
        </td>
      </tr>
    </table>

    <div style="text-align:center;margin:24px 0;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px;">
        Open Dashboard &rarr;
      </a>
    </div>

    <div style="border-top:1px solid #334155;margin-top:32px;padding-top:24px;">
      <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.7;">
        This is the kind of touch that turns a one-time job into a long-term customer.
      </p>
      <p style="margin:8px 0 0;color:#e2e8f0;font-size:14px;font-weight:700;">
        The Storage Network Team
      </p>
    </div>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "New: AI-Powered Tote Inventory \u2014 Free for Your Customers, Drives Repeat Business",
    html,
  });
}

export interface WeeklyDigestData {
  email: string;
  displayName: string;
  pageViews: number;
  quotesCreated: number;
  leadsReceived: number;
  jobsCompleted: number;
  cta: { label: string; href: string; reason: string };
  topInstallers: Array<{ name: string; score: number }>;
  unsubscribeUrl: string;
}

export async function sendWeeklyDigestEmail(
  data: WeeklyDigestData
): Promise<SendEmailResult> {
  const {
    email,
    displayName,
    pageViews,
    quotesCreated,
    leadsReceived,
    jobsCompleted,
    cta,
    topInstallers,
    unsubscribeUrl,
  } = data;

  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const totalActivity = pageViews + quotesCreated + leadsReceived + jobsCompleted;

  // Stat card helper
  const stat = (value: number, label: string, color: string) => `
    <td style="text-align:center;padding:12px 8px;">
      <p style="margin:0;font-size:28px;font-weight:900;color:${color};">${value}</p>
      <p style="margin:4px 0 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;">${label}</p>
    </td>`;

  const leaderboardRows = topInstallers
    .map(
      (t, i) => `
    <tr>
      <td style="padding:6px 0;color:#facc15;font-size:13px;font-weight:bold;width:24px;">${i + 1}.</td>
      <td style="padding:6px 0;color:#e2e8f0;font-size:13px;">${t.name}</td>
      <td style="padding:6px 0;color:#94a3b8;font-size:13px;text-align:right;">${t.score} pts</td>
    </tr>`
    )
    .join("");

  const html = emailShell(
    "Your Weekly Scorecard",
    `
    <p style="margin:0 0 20px;color:#e2e8f0;font-size:16px;">
      Hey <strong>${displayName}</strong>, here's how your week looked:
    </p>

    ${
      totalActivity === 0
        ? `<div style="background-color:#facc150d;border:1px solid #facc1533;border-radius:12px;padding:20px;margin:0 0 20px;text-align:center;">
            <p style="margin:0;color:#facc15;font-size:14px;font-weight:700;">You haven't logged in this week</p>
            <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;">Your competitors are posting on Facebook and landing jobs. Don't fall behind!</p>
          </div>`
        : ""
    }

    <!-- Stats Grid -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:12px;margin:0 0 24px;">
      <tr>
        ${stat(pageViews, "Page Views", "#60a5fa")}
        ${stat(quotesCreated, "Quotes", "#a78bfa")}
        ${stat(leadsReceived, "Leads", "#34d399")}
        ${stat(jobsCompleted, "Jobs Done", "#facc15")}
      </tr>
    </table>

    <!-- CTA -->
    <div style="background-color:#facc150d;border:1px solid #facc1533;border-radius:12px;padding:20px;margin:0 0 24px;">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Next Step</p>
      <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;">${cta.reason}</p>
      <a href="${cta.href}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:800;font-size:14px;">
        ${cta.label} &rarr;
      </a>
    </div>

    ${
      topInstallers.length > 0
        ? `<!-- Leaderboard -->
    <div style="margin:0 0 24px;">
      <p style="margin:0 0 12px;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Top Installers This Month</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${leaderboardRows}
      </table>
    </div>`
        : ""
    }

    <div style="text-align:center;margin:24px 0 16px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#334155;color:#e2e8f0;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
        Open Dashboard
      </a>
    </div>

    <div style="border-top:1px solid #334155;margin-top:24px;padding-top:16px;text-align:center;">
      <a href="${unsubscribeUrl}" style="color:#475569;font-size:11px;text-decoration:underline;">
        Unsubscribe from weekly digests
      </a>
    </div>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: `Your Weekly Scorecard \u2014 ${pageViews} views, ${leadsReceived} leads, ${jobsCompleted} jobs`,
    html,
  });
}
