import { describe, expect, it } from "vitest";
import { detectInAppBrowser, externalBrowserUrl, walletFor } from "./in-app-browser";

// Real user agents from the plans funnel
const FB_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23G90 Safari/604.1 [FBAN/FBIOS;FBAV/587.0.0.31.71;FBBV/1110946418;FBDV/iPhone17,1;FBMD/iPhone;FBSN/iOS;FBSV/26.6.2;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/1114357581;IABMV/1]";
const FB_ANDROID =
  "Mozilla/5.0 (Linux; Android 17; SM-S936U Build/CP2A.260605.016) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/156.0.8078.51 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/584.0.0.51.56;IABMV/1;]";
const IG_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/24A100 Instagram 400.0.0.1.1 (iPhone16,2; iOS 27_1; en_US)";
const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36";

describe("detectInAppBrowser", () => {
  it("spots Facebook and Instagram's browsers, by phone", () => {
    expect(detectInAppBrowser(FB_IOS)).toEqual({ app: "facebook", os: "ios" });
    expect(detectInAppBrowser(FB_ANDROID)).toEqual({ app: "facebook", os: "android" });
    expect(detectInAppBrowser(IG_IOS)).toEqual({ app: "instagram", os: "ios" });
  });
  it("leaves real browsers alone", () => {
    expect(detectInAppBrowser(SAFARI)).toBeNull();
    expect(detectInAppBrowser(CHROME_ANDROID)).toBeNull();
    expect(detectInAppBrowser(null)).toBeNull();
  });
});

describe("externalBrowserUrl", () => {
  const url = "https://www.storage-network.app/plans/checkout?design=H4x4wt&pay=1";
  it("opens Safari on iPhone and Chrome on Android, falling back to the page", () => {
    expect(externalBrowserUrl(url, "ios")).toBe(`x-safari-${url}`);
    const intent = externalBrowserUrl(url, "android")!;
    expect(intent.startsWith("intent://www.storage-network.app/plans/checkout?design=H4x4wt&pay=1#Intent;scheme=https;package=com.android.chrome;")).toBe(true);
    expect(intent).toContain(`S.browser_fallback_url=${encodeURIComponent(url)};end`);
  });
  it("refuses anything that isn't https, and desktops", () => {
    expect(externalBrowserUrl("javascript:alert(1)", "ios")).toBeNull();
    expect(externalBrowserUrl(url, "other")).toBeNull();
    expect(walletFor("other")).toBeNull();
    expect(walletFor("ios")?.name).toBe("Apple Pay");
    expect(walletFor("android")?.name).toBe("Google Pay");
  });
});
