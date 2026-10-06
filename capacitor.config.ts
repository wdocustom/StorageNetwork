import type { CapacitorConfig } from "@capacitor/cli";

// Release config. Loads the live production site inside the native shell.
// webDir (mobile/www) is only the offline fallback — it is NOT a build of the
// Next.js app and never replaces the PWA.
//
// For local dev, copy this file's shape into capacitor.config.dev.ts
// (gitignored) with server.url pointing at your LAN dev server, then run
// `npx cap sync --config capacitor.config.dev.ts`. See mobile/README.md.
const config: CapacitorConfig = {
  appId: "app.storagenetwork.installer",
  appName: "Storage Network",
  webDir: "mobile/www",
  backgroundColor: "#020617",
  // Lets the web app detect the native shell server-side and client-side.
  appendUserAgent: " StorageNetworkApp/1.0",
  server: {
    url: "https://storage-network.app/dashboard", // opens /dashboard; middleware sends signed-out users to /login
    androidScheme: "https",
    iosScheme: "https",
    cleartext: false,
    errorPath: "offline.html",
    allowNavigation: [
      "storage-network.app",
      "*.supabase.co",
      "js.stripe.com",
      "checkout.stripe.com",
      "connect.stripe.com",
      "api.stripe.com",
      "hooks.stripe.com",
    ],
  },
  ios: {
    contentInset: "never",
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#020617",
      showSpinner: false,
    },
    Keyboard: {
      resize: "body",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
