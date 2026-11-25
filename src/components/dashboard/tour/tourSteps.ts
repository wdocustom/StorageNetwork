// ═══════════════════════════════════════════════════════════════════════════
// Installer dashboard tour: the steps.
//
// Ported from the BreakAway HQ walkthrough. Two rules carry over:
//   1. Every step points at a real, already-existing control through a
//      `data-tour="..."` attribute at its call site. The tour never draws a
//      fake UI to point at.
//   2. Nothing has to be finished. A step only asks the installer to reach
//      the real entry point (tap Pricing, tap Quote), never to save a price
//      or send a quote.
//
// tourSteps.test.ts checks that every `target` below still exists as a
// data-tour (or CollapsibleSection tourId) somewhere in src/, so renaming a
// target without updating this list fails the build instead of stalling the
// tour.
// ═══════════════════════════════════════════════════════════════════════════

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** data-tour value of the element to highlight; null for a centred card. */
  target: string | null;
  /**
   * "tap": moves on when the installer taps the real element (which still
   * does its normal job: copies, opens, navigates).
   * "next": moves on with a Next button in the card.
   */
  advance: "tap" | "next";
  /** Pathname the target lives on. Omitted: any page (the tab bar). */
  route?: string;
  /** Shown instead of `body` when the target isn't on screen for this installer. */
  missingBody?: string;
  /** Skip this step silently when its target isn't on screen. */
  skipIfMissing?: boolean;
  /** The step that ends the tour with a Finish button. */
  last?: boolean;
}

export const INSTALLER_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Quick tour",
    body: "Two minutes: your link, your prices, your profile, and where quotes and jobs live. You tap the real buttons as we go. Nothing gets sent or changed.",
    target: null,
    advance: "next",
    route: "/dashboard",
  },
  {
    id: "share-link",
    title: "Copy your link",
    body: "Tap the yellow PRO pill. It copies your link: your profile page, where customers see your work and design a rack at your prices. Paste it in Facebook posts, texts and your bio.",
    missingBody:
      "Your link is your profile page, where customers see your work and design a rack at your prices. While you're on a trial, copy it from the setup checklist on this page.",
    target: "share-link",
    advance: "tap",
    route: "/dashboard",
  },
  {
    id: "setup-checklist",
    title: "Your setup checklist",
    body: "The few things that get most installers their first job. It ticks itself off as you do them.",
    target: "setup-checklist",
    advance: "next",
    route: "/dashboard",
    skipIfMissing: true,
  },
  {
    id: "settings",
    title: "Settings",
    body: "Your photo, address, prices and payouts all live in Settings. Tap the gear.",
    target: "settings",
    advance: "tap",
    route: "/dashboard",
  },
  {
    id: "profile-photo",
    title: "Add your photo",
    body: "Tap the camera to upload a photo or your logo. It's the face on your profile page, your quotes and your QR code.",
    target: "profile-photo",
    advance: "next",
    route: "/dashboard/profile",
  },
  {
    id: "profile-details",
    title: "Your business details",
    body: "Business name, phone, ZIP, street address, city and state. Your address sets delivery distances, and customers need your city and state to find you. Tap Save Changes when you've filled them in.",
    target: "profile-details",
    advance: "next",
    route: "/dashboard/profile",
  },
  {
    id: "service-area",
    title: "Service area",
    body: "How far you'll travel from your home ZIP. Customers inside this radius can book you. Add extra ZIPs if you cover more.",
    target: "service-area",
    advance: "next",
    route: "/dashboard/profile",
  },
  {
    id: "pricing-tab",
    title: "Your prices",
    body: "Tap Pricing.",
    target: "settings-tab-pricing",
    advance: "tap",
    route: "/dashboard/profile",
  },
  {
    id: "custom-pricing",
    title: "Price your units",
    body: "Custom Pricing is what you charge per slot, tote, wheels, top and add-on. These prices fill in every quote you build and your customers' design page. Tap to open it.",
    target: "custom-pricing",
    advance: "tap",
    route: "/dashboard/profile",
  },
  {
    id: "custom-pricing-body",
    title: "Set them once",
    body: "Change any price and save. Anything you leave alone uses the platform default. Delivery fees, your deposit and discount codes are on this tab too.",
    target: "custom-pricing-body",
    advance: "next",
    route: "/dashboard/profile",
  },
  {
    id: "payouts",
    title: "Get paid",
    body: "Customer deposits are paid through Stripe. Connect it here so they land in your bank account. You can also do it from the Account tab.",
    missingBody: "Customer deposits are paid through Stripe. Connect it from the Account tab here in Settings so they land in your bank account.",
    target: "payouts",
    advance: "next",
    route: "/dashboard/profile",
  },
  {
    id: "nav-quote",
    title: "Build a quote",
    body: "Quote is where you price a job and send the customer a pay link. Tap Quote.",
    target: "nav-quote",
    advance: "tap",
  },
  {
    id: "nav-jobs",
    title: "Jobs",
    body: "Every quote you send, every booking from your link and every job in progress lands in Jobs. Tap Jobs.",
    target: "nav-jobs",
    advance: "tap",
  },
  {
    id: "nav-marketing",
    title: "Marketing",
    body: "Ready-made Facebook posts, scripts and images to get your link in front of local customers. Tap Marketing.",
    target: "nav-marketing",
    advance: "tap",
  },
  {
    id: "nav-more",
    title: "Everything else",
    body: "Tap More.",
    target: "nav-more",
    advance: "tap",
  },
  {
    id: "done",
    title: "That's the tour",
    body: "Analytics shows who's visiting your link, Schedule sets the days customers can book you, and Guides & plans has build plans. You can take this tour again from here anytime.",
    target: "tour-retake",
    advance: "next",
    route: "/dashboard/more",
    last: true,
  },
];
