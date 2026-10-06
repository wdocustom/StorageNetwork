# Storage Network — native apps (iOS + Android)

Capacitor shell in `ios/` and `android/`, app id **`app.storagenetwork.installer`**, home-screen name **Storage Network**.

## The PWA stays

The native apps are an **additional** binary. Nothing about the PWA changed:

- `public/manifest.json` (name Storage Network, short name Storage, `start_url` `/login`, standalone, `#020617`), `public/icon-*.png` and `public/splash/` are untouched.
- No service worker exists in this repo, so there is nothing to register or unregister.
- "Add to Home Screen" in mobile Safari / Chrome works as before. There is no banner telling PWA users to install the store app.
- Universal links only fire when the native app is installed. A browser without the app still gets the website and the PWA.

## How it works

`capacitor.config.ts` loads **`https://storage-network.app/dashboard`** in the WebView (`server.url`). Signed-out users are redirected to `/login` by the existing middleware, then land on `/dashboard`.

- `webDir` is `mobile/www`: an offline fallback page only. It is **not** a build of Next.js and never replaces the PWA. `server.errorPath` points at `offline.html`.
- The shell appends ` StorageNetworkApp/1.0` to the User-Agent. Web code detects the shell with `isNativeApp()` (`src/lib/native/env.ts`: `Capacitor.isNativePlatform()` with a UA fallback). On the web and in the PWA it is always `false` and every native call is a no-op.
- All Capacitor plugin imports are lazy and wrapped, so a missing plugin cannot crash the site.
- Release config has `cleartext: false` and no dev URL. Dev URLs go in the gitignored `capacitor.config.dev.ts`.

### Native surfaces (v1)
`/login`, `/dashboard`, `/dashboard/leads`, `/dashboard/leads/[id]`, `/dashboard/build`, `/dashboard/inventory`, `/dashboard/schedule`, `/dashboard/referrals`, `/dashboard/marketing`, `/dashboard/profile`, `/dashboard/sales`. Realtor / affiliate / promoter / admin and `/design` stay web in the WebView.

## Dev loop

```bash
npm install
npm run cap:sync          # copies mobile/www + updates native plugin lists
npm run cap:ios           # sync + open Xcode
npm run cap:android       # sync + open Android Studio
```

Pointing the shell at a local dev server: create `capacitor.config.dev.ts` (gitignored), same shape as `capacitor.config.ts` but with `server: { url: "http://<LAN-IP>:3000", cleartext: true }`, then:

```bash
npx cap sync --config capacitor.config.dev.ts
npx cap run ios --config capacitor.config.dev.ts
```

Regenerate icons / splash (from `public/icon-512x512.png`, background `#020617`; sources live in `resources/`):

```bash
npx capacitor-assets generate --iconBackgroundColor '#020617' --iconBackgroundColorDark '#020617' \
  --splashBackgroundColor '#020617' --splashBackgroundColorDark '#020617'
```

> **Warning:** this command also writes PWA icons and rewrites `public/manifest.json`. Run `git checkout public/manifest.json` and delete the generated `icons/` folder afterwards (or add `--ios --android`).

Generated bits (`ios/App/App/public`, `capacitor.config.json`, `android/.../assets/public`) are gitignored and recreated by `cap sync`. Run it before your first build on a fresh clone.

## Auth decision

The Supabase session lives in **cookies on the https app origin**, exactly as on the web, so `src/middleware.ts` and server actions work unchanged. PWA cookie login is untouched.

Native adds a safety net: `NativeBootstrap` copies the session tokens (anon-key session only) into the **Keychain / Android Keystore** via `@aparajita/capacitor-secure-storage`, and restores them with `supabase.auth.setSession()` if the WebView cookie jar was cleared.

Two honest deviations from the original brief:

1. **Keychain, not Preferences.** `@capacitor/preferences` is UserDefaults / SharedPreferences (not encrypted). Tokens therefore use the secure-storage plugin; Preferences only holds non-secret data (job index, offline queue).
2. **Restore happens on the `/login` hop, not before the first request.** The shell loads a remote URL, so the first request can't be intercepted. If cookies are gone, middleware redirects to `/login?redirect=…`, `NativeBootstrap` restores the session there, then immediately navigates to the original destination.

`src/app/auth/callback/route.ts` accepts a `next` param (same-origin relative paths only). The custom scheme `storagenetwork://auth/callback?...` and the universal link are rewritten to this route by the shell (`resolveDeepLink`, unit-tested). The service-role key never ships in the binary.

## Stripe

- Hosted Checkout (`/payment/collect`, upsell, plans, Pro subscription) opens in the **system browser sheet** via `@capacitor/browser`; closing it reloads the page so it shows the server's real payment state (it does not blindly jump to `/payment/success`).
- **Connect onboarding stays in the WebView.** `/api/stripe/callback` checks a CSRF-state cookie that is set in the WebView's cookie jar; the system browser doesn't share that jar, so moving onboarding there would fail the check. `connect.stripe.com` is in `allowNavigation` for this reason.
- `/pay/[leadId]` keeps Stripe Elements in the WebView. **3DS on a real device is untested**; verify before relying on it.
- The Stripe secret key never ships. The native-only CSP (Stripe hosted/3DS frames, Supabase websockets) is applied to requests carrying the `StorageNetworkApp` UA on dynamic sections only; the public/PWA CSP is byte-for-byte unchanged.

## Offline job packet (native only)

Opening `/dashboard/leads/[id]` caches customer, address, scope, material list, cut-list inputs and the job photo to `Directory.Data`. Known limits:

- Notes aren't a field on leads today, so `notes` is empty.
- The computed cut plan is built client-side on `/dashboard/build` and isn't cached; only its per-unit inputs are.
- If the **page can't load at all**, `mobile/www/offline.html` shows on iOS the cached job list. On Android the Capacitor error page has no plugin access, so it shows a retry button only.
- Photo upload and mark-complete are queued (photo bytes in `Directory.Data`, queue in Preferences) with an Idempotency-Key and replayed on reconnect. **A queued completion is never shown as paid / payout sent.**

`completeJob` / `completeJobWithProof` were **not** idempotent (a replay could move a paid job back to `payment_pending` and decrement inventory twice). They now only advance from a pre-completion status and accept an optional Idempotency-Key (migration 143). `uploadJobPhoto` uses a deterministic path when given a key. Covered by `src/app/actions/jobs-idempotency.test.ts`.

## Push and links

- Push permission is requested **once, ~1.5 s after the first `/dashboard*` load, inside the native app only**. Never on marketing pages or in the PWA.
- Token is stored by `registerDeviceToken` into `device_tokens` (migration `143_native_app.sql`, RLS scoped to the owning user). **Migration is not applied to production.**
- Tapping a notification opens `/dashboard/leads/[leadId]` from the payload's `leadId` (falls back to `/dashboard`).
- Sending pushes (APNs/FCM server side) is **not** built here; this PR only registers devices.
- Universal links: `/dashboard`, `/login`, `/pay`, `/payment/success`. Association files are in `public/.well-known/` with **placeholders** (`TEAMID`, `REPLACE_WITH_RELEASE_SIGNING_SHA256`). Fallback scheme `storagenetwork://`.

## Review surface

Info.plist: camera (finished installs, tote barcodes/QR), photo library (job photos), remote-notification background mode. Android: `CAMERA`, `POST_NOTIFICATIONS`. No location, contacts, microphone, background location or Face ID. `allowBackup=false`, cleartext off, no debug `server.url`.

## The five things a human has to do

1. **Apple team.** Open `ios/App/App.xcworkspace`, set the Team on the App target, and confirm **Push Notifications** and **Associated Domains** capabilities (entitlements are in `ios/App/App/App.entitlements`; switch `aps-environment` to `production` for release). Replace `TEAMID` in `public/.well-known/apple-app-site-association` with your 10-character Apple Team ID and deploy. Create an APNs key (.p8) in the Apple Developer portal and upload it to Firebase (Cloud Messaging → Apple app configuration) or your push sender.
2. **FCM file.** In Firebase, add Android app `app.storagenetwork.installer`, download `google-services.json` to `android/app/google-services.json` (gitignored; see `google-services.json.example`).
3. **Signing.** Android: create a release keystore, configure Play App Signing, and put the **release/Play signing SHA-256** into `public/.well-known/assetlinks.json` (replace the placeholder) and deploy. iOS: distribution certificate + provisioning profile via Xcode automatic signing.
4. **Stripe return URLs / Supabase redirects.** In Supabase → Auth → URL Configuration add `storagenetwork://auth/callback` to Redirect URLs. In Stripe, confirm Checkout success/cancel URLs use `https://storage-network.app/...` (no change expected) and test one hosted Checkout in the system browser sheet plus one 3DS card on `/pay`. Apply migration 143 to the Supabase project.
5. **Store listing.** App Store Connect + Play Console: screenshots, description, privacy answers (camera, photos, push token / device ID), privacy policy URL, support URL, and the review-notes login for a demo installer account.
