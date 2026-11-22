import "server-only";

import { randomUUID } from "crypto";
import { getServiceClient } from "@/lib/supabase-server";
import { REVIEW_LIMITS } from "@/lib/reviews";

// ═══════════════════════════════════════════════════════════════════════════
// Review photos: the browser resizes to a JPEG (≤1600px) before sending; the
// server checks it really is a JPEG under the size cap and stores it in the
// public review-photos bucket. Only ever called after the review itself has
// been authorised (plan token + device, or the one-time installer link).
// ═══════════════════════════════════════════════════════════════════════════

export const REVIEW_PHOTOS_BUCKET = "review-photos";

/** JPEG files start FF D8 FF. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** The photo files in a submitted form (field "photos"), capped. */
export function photoFiles(form: FormData): File[] {
  return form
    .getAll("photos")
    .filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f && (f as File).size > 0)
    .slice(0, REVIEW_LIMITS.photos);
}

export type PhotoUpload = { ok: true; urls: string[] } | { ok: false; error: string };

/** Store each photo under `folder/`; all or nothing. */
export async function uploadReviewPhotos(folder: string, files: File[]): Promise<PhotoUpload> {
  if (!files.length) return { ok: true, urls: [] };
  const buffers: Buffer[] = [];
  for (const f of files) {
    if (f.size > REVIEW_LIMITS.photoBytes) return { ok: false, error: "One of the photos is too large. Try a different one." };
    const buf = Buffer.from(await f.arrayBuffer());
    if (!isJpeg(buf)) return { ok: false, error: "We couldn't read one of the photos. Try a different one." };
    buffers.push(buf);
  }
  const storage = getServiceClient().storage.from(REVIEW_PHOTOS_BUCKET);
  const paths: string[] = [];
  for (const buf of buffers) {
    const path = `${folder}/${randomUUID()}.jpg`;
    const { error } = await storage.upload(path, buf, { contentType: "image/jpeg", upsert: false });
    if (error) {
      console.error("[ReviewPhotos] upload failed:", error.message);
      if (paths.length) await storage.remove(paths).catch(() => undefined);
      return { ok: false, error: "We couldn't upload your photos. Try again, or send the review without them." };
    }
    paths.push(path);
  }
  return { ok: true, urls: paths.map((p) => storage.getPublicUrl(p).data.publicUrl) };
}
