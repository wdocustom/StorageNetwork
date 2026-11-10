import { beforeEach, describe, expect, it, vi } from "vitest";

const savePushSubscription = vi.fn(async () => ({ success: true }));
const removePushSubscription = vi.fn(async () => ({ success: true }));
vi.mock("@/app/actions/push", () => ({
  savePushSubscription: (...a: unknown[]) => savePushSubscription(...(a as [])),
  removePushSubscription: (...a: unknown[]) => removePushSubscription(...(a as [])),
  sendTestPush: vi.fn(),
}));

import { resubscribeIfKeyChanged } from "./usePushNotifications";

// Two distinct base64url P-256 public keys (65 bytes each)
const KEY_A = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const KEY_B = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";

function bytes(k: string) {
  const raw = atob(k.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (k.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer;
}

function fakeSub(endpoint: string, key: string | null) {
  return {
    endpoint,
    options: { applicationServerKey: key ? bytes(key) : null },
    unsubscribe: vi.fn(async () => true),
    toJSON: () => ({ endpoint, keys: { p256dh: "p", auth: "a" } }),
  } as unknown as PushSubscription & { unsubscribe: ReturnType<typeof vi.fn> };
}

describe("resubscribeIfKeyChanged", () => {
  beforeEach(() => {
    savePushSubscription.mockClear();
    removePushSubscription.mockClear();
  });

  it("leaves a subscription made with the current key alone", async () => {
    const sub = fakeSub("https://push/old", KEY_A);
    const reg = { pushManager: { subscribe: vi.fn() } } as unknown as ServiceWorkerRegistration;
    expect(await resubscribeIfKeyChanged(reg, sub, KEY_A)).toBe(sub);
    expect(sub.unsubscribe).not.toHaveBeenCalled();
    expect(savePushSubscription).not.toHaveBeenCalled();
  });

  it("swaps an old-key subscription for a new one and updates the server", async () => {
    const old = fakeSub("https://push/old", KEY_A);
    const fresh = fakeSub("https://push/new", KEY_B);
    const subscribe = vi.fn(async () => fresh);
    const reg = { pushManager: { subscribe } } as unknown as ServiceWorkerRegistration;
    expect(await resubscribeIfKeyChanged(reg, old, KEY_B)).toBe(fresh);
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(savePushSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://push/new" }),
      expect.anything(),
    );
    expect(removePushSubscription).toHaveBeenCalledWith("https://push/old");
  });

  it("leaves it alone when the browser doesn't expose the key", async () => {
    const sub = fakeSub("https://push/old", null);
    const reg = { pushManager: { subscribe: vi.fn() } } as unknown as ServiceWorkerRegistration;
    expect(await resubscribeIfKeyChanged(reg, sub, KEY_B)).toBe(sub);
  });
});
