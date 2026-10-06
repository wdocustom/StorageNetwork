// ═══════════════════════════════════════════════════════════════════════════
// Native bridge. Every function:
//   • is a no-op (returns null/false) on the web and in the PWA,
//   • lazy-imports its Capacitor plugin only when running in the native shell,
//   • swallows a missing/unavailable plugin instead of throwing, so a stale
//     binary can never crash the website.
// ═══════════════════════════════════════════════════════════════════════════

import { isNativeApp, nativePlatform } from "@/lib/native/env";
import { uploadJobPhoto, type PhotoUploadResult } from "@/app/actions/photo-upload";

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isNativeApp()) return fallback;
  try {
    return await fn();
  } catch (err) {
    console.warn(`[native:${label}]`, err);
    return fallback;
  }
}

// ── Camera → existing photo-upload action ────────────────────────────────

export interface CapturedPhoto {
  file: File;
}

/** Take (or pick) a job photo. Returns null on web or when the user cancels. */
export async function capturePhotoFile(): Promise<CapturedPhoto | null> {
  return safe<CapturedPhoto | null>(
    "camera",
    async () => {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        width: 2048,
        correctOrientation: true,
      });
      if (!photo.webPath) return null;
      const blob = await (await fetch(photo.webPath)).blob();
      const ext = photo.format || "jpg";
      return { file: new File([blob], `job-${Date.now()}.${ext}`, { type: blob.type || "image/jpeg" }) };
    },
    null
  );
}

/** Capture a photo and upload it through the existing `uploadJobPhoto` action. */
export async function captureJobPhoto(leadId: string): Promise<PhotoUploadResult | null> {
  const captured = await capturePhotoFile();
  if (!captured) return null;
  const formData = new FormData();
  formData.append("photo", captured.file);
  return uploadJobPhoto(leadId, formData);
}

// ── QR / barcode (tote flow) ─────────────────────────────────────────────

/**
 * Scan one code natively. Returns the raw value, or null.
 * Reads QR plus the retail formats the tote flow already accepts (UPC/EAN/Code128/39).
 */
export async function scanQr(): Promise<string | null> {
  return safe<string | null>(
    "scan",
    async () => {
      const { BarcodeScanner, BarcodeFormat } = await import("@capacitor-mlkit/barcode-scanning");
      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) return null;

      let perm = await BarcodeScanner.checkPermissions();
      if (perm.camera !== "granted") perm = await BarcodeScanner.requestPermissions();
      if (perm.camera !== "granted" && perm.camera !== "limited") return null;

      if (nativePlatform() === "android") {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      const { barcodes } = await BarcodeScanner.scan({ formats: [
          BarcodeFormat.QrCode,
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
        ],
      });
      return barcodes[0]?.rawValue ?? null;
    },
    null
  );
}

// ── Share / maps / tel ───────────────────────────────────────────────────

export async function shareReferral(opts: { url: string; title?: string; text?: string }): Promise<boolean> {
  return safe("share", async () => {
    const { Share } = await import("@capacitor/share");
    await Share.share({
      title: opts.title ?? "Storage Network",
      text: opts.text,
      url: opts.url,
      dialogTitle: "Share your referral link",
    });
    return true;
  }, false);
}

/** Apple Maps on iOS, geo: intent on Android. Returns false on web (caller keeps its https link). */
export function openMaps(address: string): boolean {
  if (!isNativeApp() || !address) return false;
  const q = encodeURIComponent(address);
  window.location.href = nativePlatform() === "ios" ? `maps://?q=${q}` : `geo:0,0?q=${q}`;
  return true;
}

export function openPhone(phone: string): boolean {
  if (!isNativeApp() || !phone) return false;
  window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
  return true;
}

// ── Browser (Stripe Checkout etc.) ───────────────────────────────────────

/**
 * Open a hosted Stripe page. Native → system browser sheet, and when the user
 * closes it the WebView goes to `returnPath` (or reloads). Web/PWA → plain
 * navigation, exactly as before.
 */
export async function openHostedUrl(url: string, returnPath?: string): Promise<void> {
  if (!isNativeApp()) {
    window.location.href = url;
    return;
  }
  try {
    const { Browser } = await import("@capacitor/browser");
    const handle = await Browser.addListener("browserFinished", () => {
      handle.remove();
      if (returnPath) window.location.href = returnPath;
      else window.location.reload();
    });
    await Browser.open({ url });
  } catch (err) {
    console.warn("[native:browser]", err);
    window.location.href = url;
  }
}

// ── Offline job packet ───────────────────────────────────────────────────

export interface JobPacket {
  leadId: string;
  cachedAt: string;
  customer: { name: string | null; email: string | null; phone: string | null };
  address: string | null;
  scheduledAt: string | null;
  status: string | null;
  scope: unknown; // quote_data: units / scope of work
  materialList: unknown;
  cutList: unknown;
  notes: string | null;
  images: { url: string; file: string }[];
}

const PACKET_DIR = "job-packets";
const INDEX_KEY = "job_packet_index";

interface PacketIndexEntry {
  leadId: string;
  customerName: string | null;
  address: string | null;
  scheduledAt: string | null;
  cachedAt: string;
}

async function fs() {
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  return { Filesystem, Directory, Encoding };
}

async function updateIndex(entry: PacketIndexEntry) {
  const { Preferences } = await import("@capacitor/preferences");
  const raw = (await Preferences.get({ key: INDEX_KEY })).value;
  const list: PacketIndexEntry[] = raw ? JSON.parse(raw) : [];
  const next = [entry, ...list.filter((e) => e.leadId !== entry.leadId)].slice(0, 25);
  await Preferences.set({ key: INDEX_KEY, value: JSON.stringify(next) });
}

export async function listCachedJobs(): Promise<PacketIndexEntry[]> {
  return safe<PacketIndexEntry[]>("packet-list", async () => {
    const { Preferences } = await import("@capacitor/preferences");
    const raw = (await Preferences.get({ key: INDEX_KEY })).value;
    return raw ? (JSON.parse(raw) as PacketIndexEntry[]) : [];
  }, []);
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Cache everything needed to do the job with no signal. Native only. */
export async function cacheJobPacket(
  packet: Omit<JobPacket, "cachedAt" | "images">,
  imageUrls: string[] = []
): Promise<boolean> {
  return safe("packet-cache", async () => {
    const { Filesystem, Directory, Encoding } = await fs();
    const images: JobPacket["images"] = [];

    for (const [i, url] of Array.from(imageUrls.slice(0, 12).entries())) {
      try {
        const blob = await (await fetch(url)).blob();
        const ext = (blob.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
        const file = `${PACKET_DIR}/${packet.leadId}/img-${i}.${ext}`;
        await Filesystem.writeFile({
          path: file,
          data: await blobToBase64(blob),
          directory: Directory.Data,
          recursive: true,
        });
        images.push({ url, file });
      } catch {
        /* an image that will not cache must not block the packet */
      }
    }

    const full: JobPacket = { ...packet, images, cachedAt: new Date().toISOString() };
    await Filesystem.writeFile({
      path: `${PACKET_DIR}/${packet.leadId}/packet.json`,
      data: JSON.stringify(full),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await updateIndex({
      leadId: packet.leadId,
      customerName: packet.customer.name,
      address: packet.address,
      scheduledAt: packet.scheduledAt,
      cachedAt: full.cachedAt,
    });
    return true;
  }, false);
}

export async function readJobPacket(leadId: string): Promise<(JobPacket & { imageSrc: Record<string, string> }) | null> {
  return safe("packet-read", async () => {
    const { Filesystem, Directory, Encoding } = await fs();
    const res = await Filesystem.readFile({
      path: `${PACKET_DIR}/${leadId}/packet.json`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const packet = JSON.parse(String(res.data)) as JobPacket;
    const imageSrc: Record<string, string> = {};
    for (const img of packet.images) {
      try {
        const f = await Filesystem.readFile({ path: img.file, directory: Directory.Data });
        const ext = img.file.split(".").pop() || "jpeg";
        imageSrc[img.url] = `data:image/${ext};base64,${String(f.data)}`;
      } catch {
        /* missing image file — render without it */
      }
    }
    return { ...packet, imageSrc };
  }, null);
}

// ── Push ─────────────────────────────────────────────────────────────────

/**
 * Ask for notification permission and register the device token. Native only,
 * and only called from the dashboard (never the marketing site / PWA).
 */
export async function registerPush(
  saveToken: (token: string, platform: "ios" | "android") => Promise<unknown>,
  onTap: (data: Record<string, unknown> | undefined) => void
): Promise<boolean> {
  return safe("push", async () => {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    await PushNotifications.addListener("registration", (t) => {
      const platform = nativePlatform();
      if (platform === "ios" || platform === "android") void saveToken(t.value, platform);
    });
    await PushNotifications.addListener("registrationError", (e) =>
      console.warn("[native:push] registration error", e)
    );
    await PushNotifications.addListener("pushNotificationActionPerformed", (a) =>
      onTap(a.notification.data as Record<string, unknown> | undefined)
    );

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return false;
    await PushNotifications.register();
    return true;
  }, false);
}
