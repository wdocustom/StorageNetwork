// ═══════════════════════════════════════════════════════════════════════════
// Native shell detection. Safe on the server, on the web, and in the PWA —
// all three return false. Never imports a Capacitor package (the bridge is
// injected into the WebView by the native shell).
// ═══════════════════════════════════════════════════════════════════════════

export const NATIVE_UA_TOKEN = "StorageNetworkApp";
export const NATIVE_SCHEME = "storagenetwork";
export const WEB_ORIGIN = "https://storage-network.app";

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function capacitorGlobal(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True only inside the Capacitor iOS/Android shell. False on web + PWA. */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (capacitorGlobal()?.isNativePlatform?.()) return true;
    return navigator.userAgent.includes(NATIVE_UA_TOKEN);
  } catch {
    return false;
  }
}

export function nativePlatform(): "ios" | "android" | "web" {
  try {
    const p = capacitorGlobal()?.getPlatform?.();
    if (p === "ios" || p === "android") return p;
  } catch {
    /* fall through */
  }
  return "web";
}
