// ═══════════════════════════════════════════════════════════════════════════
// In-app browsers (Facebook, Instagram, Messenger…)
//
// Ad clicks open inside the app's own browser, which hides Apple Pay and
// Google Pay: Stripe can only offer card, Link, Cash App and the like. The
// way back to the wallets is to reopen the page in Safari / Chrome:
//   iOS 17+  x-safari-https://…  opens the URL in Safari
//   Android  intent://…#Intent;scheme=https;package=com.android.chrome;…
// Neither is guaranteed (older iOS, the app can refuse), so callers keep a
// manual fallback ("tap ••• → Open in external browser").
// ═══════════════════════════════════════════════════════════════════════════

export type InAppApp = "facebook" | "instagram" | "other";
export type MobileOs = "ios" | "android" | "other";

export interface InAppBrowser {
  app: InAppApp;
  os: MobileOs;
}

export function detectOs(ua: string): MobileOs {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/** The in-app browser this user agent belongs to, or null for a real browser. */
export function detectInAppBrowser(ua: string | null | undefined): InAppBrowser | null {
  if (!ua) return null;
  const os = detectOs(ua);
  if (/Instagram/i.test(ua)) return { app: "instagram", os };
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS|MessengerForiOS|\bFBSN\b/i.test(ua)) return { app: "facebook", os };
  if (/musical_ly|BytedanceWebview|TikTok|Snapchat|LinkedInApp|Pinterest|Twitter|Line\//i.test(ua)) return { app: "other", os };
  return null;
}

/** The wallet a phone's real browser offers. */
export function walletFor(os: MobileOs): { name: string; browser: string } | null {
  if (os === "ios") return { name: "Apple Pay", browser: "Safari" };
  if (os === "android") return { name: "Google Pay", browser: "Chrome" };
  return null;
}

export function appLabel(app: InAppApp): string {
  return app === "facebook" ? "Facebook" : app === "instagram" ? "Instagram" : "this app";
}

/** A link that reopens `url` (absolute https) in the phone's real browser. */
export function externalBrowserUrl(url: string, os: MobileOs): string | null {
  if (!/^https:\/\//i.test(url)) return null;
  if (os === "ios") return `x-safari-${url}`;
  if (os === "android") {
    const rest = url.replace(/^https:\/\//i, "");
    return `intent://${rest}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  }
  return null;
}
