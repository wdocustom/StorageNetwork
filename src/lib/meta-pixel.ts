// ═══════════════════════════════════════════════════════════════════════════
// Meta (Facebook / Instagram) Pixel — client helper
//
// The plans funnel runs on Facebook ads. Without a pixel, Meta can't see
// who designs, starts checkout or buys, so it optimizes for cheap clicks
// and can't retarget visitors who designed a rack and left. Loaded on
// /plans pages only (MetaPixel), when NEXT_PUBLIC_META_PIXEL_ID is set at
// build time. Without it every call here is a no-op.
// ═══════════════════════════════════════════════════════════════════════════

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

type Fbq = (cmd: "track" | "trackCustom", event: string, params?: Record<string, unknown>, opts?: { eventID?: string }) => void;

/** Standard Meta event (ViewContent, InitiateCheckout, Lead, Purchase…). */
export function metaTrack(event: string, params?: Record<string, unknown>): void {
  if (!META_PIXEL_ID || typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  try {
    fbq?.("track", event, params);
  } catch {
    /* never break the page for analytics */
  }
}
