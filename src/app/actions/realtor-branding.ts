"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import {
  enforceActionRateLimit,
  RateLimitError,
} from "@/lib/server/action-rate-limit";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor Custom Branding — server actions
//
// Three knobs the realtor controls for the recipient gift page
// (/gift/[token]):
//
//   - photo (head-shot, circular avatar)
//   - logo  (brokerage logo, small badge)
//   - signature (default closing line — shows when no per-gift
//                personal_message is supplied)
//
// Photo + logo files live in a Supabase Storage bucket called
// `realtor-branding`. Bucket layout: {userId}/photo.{ext} and
// {userId}/logo.{ext}. Bucket is created lazily on first upload —
// same idempotent pattern src/app/actions/photo-upload.ts:19-27 uses.
//
// All three values are stored as nullable text columns on `profiles`
// (see migration 111). Clearing a value = setting the column to NULL.
// ═══════════════════════════════════════════════════════════════════════════

const BUCKET = "realtor-branding";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — head-shots and logos are small
const SIGNATURE_MAX_LEN = 500;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

async function ensureBucket(): Promise<void> {
  const db = getServiceClient();
  const { data } = await db.storage.getBucket(BUCKET);
  if (!data) {
    await db.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_FILE_BYTES,
    });
  }
}

export interface RealtorBranding {
  photoUrl: string | null;
  logoUrl: string | null;
  signature: string | null;
}

export async function getRealtorBranding(): Promise<RealtorBranding | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const db = getServiceClient();
  const { data } = await db
    .from("profiles")
    .select("realtor_photo_url, realtor_logo_url, realtor_signature")
    .eq("id", user.id)
    .single();

  if (!data) return null;
  return {
    photoUrl: (data.realtor_photo_url as string | null) ?? null,
    logoUrl: (data.realtor_logo_url as string | null) ?? null,
    signature: (data.realtor_signature as string | null) ?? null,
  };
}

// ── Save signature (text-only update, no file upload) ─────────────────────

export async function saveRealtorSignature(
  signature: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  try {
    await enforceActionRateLimit({
      action: "realtor-branding.saveSignature",
      limit: 30,
      window: "5 m",
      identify: "user",
    });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const trimmed = signature.trim();
  if (trimmed.length > SIGNATURE_MAX_LEN) {
    return { ok: false, error: `Signature is too long (${trimmed.length}/${SIGNATURE_MAX_LEN} chars).` };
  }

  const db = getServiceClient();
  const { error } = await db
    .from("profiles")
    .update({ realtor_signature: trimmed.length === 0 ? null : trimmed })
    .eq("id", user.id);

  if (error) {
    console.error("[Branding] signature save failed:", error);
    return { ok: false, error: "Could not save signature." };
  }
  return { ok: true };
}

// ── Upload / clear photo or logo ──────────────────────────────────────────

type Kind = "photo" | "logo";

const KIND_COLUMN: Record<Kind, "realtor_photo_url" | "realtor_logo_url"> = {
  photo: "realtor_photo_url",
  logo: "realtor_logo_url",
};

export interface UploadResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export async function uploadRealtorBrandingImage(
  kind: Kind,
  formData: FormData
): Promise<UploadResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Per-user rate limit so a misbehaving client can't flood the bucket.
  try {
    await enforceActionRateLimit({
      action: `realtor-branding.upload.${kind}`,
      limit: 20,
      window: "10 m",
      identify: "user",
    });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file supplied." };
  }
  if (file.size === 0) {
    return { ok: false, error: "File is empty." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`,
    };
  }
  if (!ALLOWED_MIME.has(file.type.toLowerCase())) {
    return { ok: false, error: `Unsupported file type (${file.type}). Use PNG, JPG, WEBP, or GIF.` };
  }

  await ensureBucket();
  const db = getServiceClient();

  // Stable file name per kind so re-uploads overwrite cleanly (upsert).
  // Including the extension preserves the right Content-Type on serve.
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${user.id}/${kind}.${ext}`;

  // Sweep any prior file at a different extension so we don't accumulate
  // stale copies (e.g. user uploads photo.jpg, then later photo.png).
  const { data: existing } = await db.storage.from(BUCKET).list(user.id, { limit: 100 });
  const stale = (existing ?? [])
    .map((f) => f.name)
    .filter((name) => name.startsWith(`${kind}.`) && name !== `${kind}.${ext}`);
  if (stale.length > 0) {
    await db.storage
      .from(BUCKET)
      .remove(stale.map((name) => `${user.id}/${name}`))
      .catch(() => undefined);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: "60",
    });
  if (upErr) {
    console.error(`[Branding] upload ${kind} failed:`, upErr);
    return { ok: false, error: upErr.message || "Upload failed." };
  }

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust so the new image appears even when the URL is identical
  // to the previous one (same extension). Cheap and safe.
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await db
    .from("profiles")
    .update({ [KIND_COLUMN[kind]]: publicUrl })
    .eq("id", user.id);
  if (dbErr) {
    console.error(`[Branding] DB update for ${kind} URL failed:`, dbErr);
    return { ok: false, error: "Saved file but couldn't update profile. Try again." };
  }

  return { ok: true, url: publicUrl };
}

// ── Clear photo or logo ───────────────────────────────────────────────────

export async function clearRealtorBrandingImage(kind: Kind): Promise<{ ok: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const db = getServiceClient();

  // Best-effort remove every file under the realtor's folder that
  // matches this kind. Storage errors don't block the DB clear — the
  // public URL is what the user sees and we nulled that.
  const { data: existing } = await db.storage.from(BUCKET).list(user.id, { limit: 100 });
  const toRemove = (existing ?? [])
    .map((f) => f.name)
    .filter((name) => name.startsWith(`${kind}.`));
  if (toRemove.length > 0) {
    await db.storage
      .from(BUCKET)
      .remove(toRemove.map((name) => `${user.id}/${name}`))
      .catch(() => undefined);
  }

  const { error: dbErr } = await db
    .from("profiles")
    .update({ [KIND_COLUMN[kind]]: null })
    .eq("id", user.id);
  if (dbErr) {
    console.error(`[Branding] clear ${kind} DB update failed:`, dbErr);
    return { ok: false, error: "Could not clear." };
  }
  return { ok: true };
}
