"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isNativeApp, nativePlatform } from "@/lib/native/env";
import { resolveDeepLink, notificationTargetPath } from "@/lib/native/deep-link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

// ═══════════════════════════════════════════════════════════════════════════
// NativeBootstrap — mounted once in the root layout. Does NOTHING on the web
// or in the PWA (isNativeApp() is false there). Inside the Capacitor shell:
//
//   • tags <html class="native-app"> (CSS: no pull-to-refresh, safe areas)
//   • status bar styling
//   • persists the Supabase session in the Keychain/Keystore and restores it
//     when the cookie jar was cleared (see mobile/README.md → Auth)
//   • Android back = history.back(); exit only on /dashboard
//   • universal links + storagenetwork:// deep links → in-WebView navigation
//   • flushes the offline queue when the network returns
//   • asks for push permission after the first dashboard load
// ═══════════════════════════════════════════════════════════════════════════

const SESSION_KEY = "sn_supabase_session";

async function secureStorage() {
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  return SecureStorage;
}

export default function NativeBootstrap() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const pushStarted = useRef(false);

  // ── One-time native setup ───────────────────────────────────────────────
  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.classList.add("native-app");

    const cleanups: Array<() => void> = [];
    let cancelled = false;

    (async () => {
      try {
        const [{ StatusBar, Style }, { App }, { Network }] = await Promise.all([
          import("@capacitor/status-bar"),
          import("@capacitor/app"),
          import("@capacitor/network"),
        ]);

        // Dark app → light status bar text.
        await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        if (nativePlatform() === "android") {
          await StatusBar.setBackgroundColor({ color: "#020617" }).catch(() => {});
        }

        // Android back: history.back(); exit only from /dashboard.
        const back = await App.addListener("backButton", () => {
          const p = pathRef.current || "";
          if (p === "/dashboard" || p === "/dashboard/" || window.history.length <= 1) {
            void App.exitApp();
          } else {
            window.history.back();
          }
        });
        cleanups.push(() => void back.remove());

        // Universal links + custom scheme.
        const open = await App.addListener("appUrlOpen", ({ url }) => {
          const target = resolveDeepLink(url);
          if (target) window.location.href = target;
        });
        cleanups.push(() => void open.remove());

        // Offline queue replay.
        const { flushQueue } = await import("@/lib/native/offline-queue");
        const net = await Network.addListener("networkStatusChange", (s) => {
          if (s.connected) void flushQueue();
        });
        cleanups.push(() => void net.remove());
        void flushQueue();

        if (cancelled) cleanups.forEach((fn) => fn());
      } catch (err) {
        console.warn("[native] bootstrap failed (site keeps working):", err);
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  // ── Session persistence / restore ───────────────────────────────────────
  useEffect(() => {
    if (!isNativeApp()) return;
    const supabase = getSupabaseBrowserClient();
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const store = await secureStorage();

        // Persist whenever the session changes (anon-key session only —
        // the service-role key never reaches the client).
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          try {
            if (session?.refresh_token) {
              await store.set(
                SESSION_KEY,
                JSON.stringify({
                  access_token: session.access_token,
                  refresh_token: session.refresh_token,
                })
              );
            } else if (event === "SIGNED_OUT") {
              await store.remove(SESSION_KEY);
            }
          } catch {
            /* storage failure must never break auth */
          }
        });
        unsub = () => data.subscription.unsubscribe();

        // Restore: the WebView cookie jar can be cleared (OS eviction, "clear
        // website data"). If there is no session but we hold tokens, rebuild
        // the cookies, then continue to where the user was headed.
        const { data: current } = await supabase.auth.getSession();
        if (current.session) return;

        const raw = await store.get(SESSION_KEY);
        if (typeof raw !== "string") return;
        const saved = JSON.parse(raw) as { access_token: string; refresh_token: string };
        const { error } = await supabase.auth.setSession(saved);
        if (error) {
          await store.remove(SESSION_KEY); // dead refresh token — stop retrying
          return;
        }
        if (pathRef.current.startsWith("/login")) {
          const redirect = new URLSearchParams(window.location.search).get("redirect");
          window.location.href =
            redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/dashboard";
        }
      } catch (err) {
        console.warn("[native] session restore skipped:", err);
      }
    })();

    return () => unsub?.();
  }, []);

  // ── Push: only after the first dashboard load, native only ──────────────
  useEffect(() => {
    if (!isNativeApp() || pushStarted.current) return;
    if (!pathname?.startsWith("/dashboard")) return;
    pushStarted.current = true;

    const t = window.setTimeout(async () => {
      const [{ registerPush }, { registerDeviceToken }] = await Promise.all([
        import("@/lib/native/capacitor"),
        import("@/app/actions/device-tokens"),
      ]);
      await registerPush(
        (token, platform) => registerDeviceToken(token, platform),
        (data) => {
          window.location.href = notificationTargetPath(data);
        }
      );
    }, 1500); // let the dashboard paint first
    return () => window.clearTimeout(t);
  }, [pathname]);

  return null;
}
