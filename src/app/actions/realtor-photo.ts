"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import {
  enforceActionRateLimit,
  RateLimitError,
} from "@/lib/server/action-rate-limit";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor profile photo — server actions
//
// Single optional asset realtors can upload: a head-shot that appears on
// the recipient invite email and on /gift/[token]. Stored in the
// `realtor-branding` Supabase Storage bucket at {userId}/photo.{ext},
// URL kept on profiles.realtor_photo_url (migration 111).
//
// The logo + signature features that originally shipped alongside this
// were removed — realtors found the upload flow too heavy for the
// payoff. Photo stayed because most realtors already have a head-shot
// they share on socials.
// ═══════════════════════════════════════════════════════════════════════════

const BUCKET = "realtor-branding";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
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

export interface RealtorPhoto {
  photoUrl: string | null;
}

export async function getRealtorPhoto(): Promise<RealtorPhoto | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const db = getServiceClient();
  const { data } = await db
    .from("profiles")
    .select("realtor_photo_url")
    .eq("id", user.id)
    .single();

  if (!data) return null;
  return { photoUrl: (data.realtor_photo_url as string | null) ?? null };
}

export interface UploadResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export async function uploadRealtorPhoto(formData: FormData): Promise<UploadResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  try {
    await enforceActionRateLimit({
      action: "realtor-photo.upload",
      limit: 20,
      window: "10 m",
      identify: "user",
    });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file supplied." };
  if (file.size === 0) return { ok: false, error: "File is empty." };
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

  // Stable file name so re-uploads overwrite cleanly. Extension preserved
  // so the Content-Type the bucket serves matches the bytes.
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${user.id}/photo.${ext}`;

  // Sweep any prior photo at a different extension so we don't accumulate
  // stale copies (e.g. user uploads photo.jpg, then later photo.png).
  const { data: existing } = await db.storage.from(BUCKET).list(user.id, { limit: 100 });
  const stale = (existing ?? [])
    .map((f) => f.name)
    .filter((name) => name.startsWith("photo.") && name !== `photo.${ext}`);
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
    console.error("[Photo] upload failed:", upErr);
    return { ok: false, error: upErr.message || "Upload failed." };
  }

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust so the new image shows immediately when the URL is identical
  // to the prior one (same extension).
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await db
    .from("profiles")
    .update({ realtor_photo_url: publicUrl })
    .eq("id", user.id);
  if (dbErr) {
    console.error("[Photo] DB update failed:", dbErr);
    return { ok: false, error: "Saved file but couldn't update profile. Try again." };
  }

  return { ok: true, url: publicUrl };
}

export async function clearRealtorPhoto(): Promise<{ ok: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const db = getServiceClient();

  const { data: existing } = await db.storage.from(BUCKET).list(user.id, { limit: 100 });
  const toRemove = (existing ?? [])
    .map((f) => f.name)
    .filter((name) => name.startsWith("photo."));
  if (toRemove.length > 0) {
    await db.storage
      .from(BUCKET)
      .remove(toRemove.map((name) => `${user.id}/${name}`))
      .catch(() => undefined);
  }

  const { error: dbErr } = await db
    .from("profiles")
    .update({ realtor_photo_url: null })
    .eq("id", user.id);
  if (dbErr) {
    console.error("[Photo] clear DB update failed:", dbErr);
    return { ok: false, error: "Could not clear." };
  }
  return { ok: true };
}
