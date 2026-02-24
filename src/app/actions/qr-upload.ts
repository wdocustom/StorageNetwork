"use server";

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COMMUNITY_BUCKET = "community-images";

// In-memory session store (cleared on server restart — fine for ephemeral upload sessions)
// Key: sessionToken, Value: session data
const sessions = new Map<
  string,
  {
    userId: string;
    createdAt: number;
    images: { url: string; storagePath: string; name: string }[];
  }
>();

// Clean expired sessions (older than 30 minutes)
function cleanExpired() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  sessions.forEach((session, token) => {
    if (session.createdAt < cutoff) sessions.delete(token);
  });
}

// ── Create a new upload session ──────────────────────────────────────────
export async function createUploadSession(
  userId: string
): Promise<{ token: string }> {
  cleanExpired();
  const token = randomUUID();
  sessions.set(token, { userId, createdAt: Date.now(), images: [] });
  return { token };
}

// ── Upload image to session (called from the mobile upload API) ──────────
export async function uploadToSession(
  token: string,
  formData: FormData
): Promise<{ success: boolean; error?: string; url?: string }> {
  const session = sessions.get(token);
  if (!session) return { success: false, error: "Session expired or invalid." };

  // Check expiry (30 min)
  if (Date.now() - session.createdAt > 30 * 60 * 1000) {
    sessions.delete(token);
    return { success: false, error: "Upload session has expired." };
  }

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) return { success: false, error: "No image provided." };

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
  if (file.type && !allowed.includes(file.type)) {
    return { success: false, error: "Invalid image type." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: "Image must be under 10MB." };
  }

  // Ensure bucket
  const { data: bucketData } = await supabase.storage.getBucket(COMMUNITY_BUCKET);
  if (!bucketData) {
    await supabase.storage.createBucket(COMMUNITY_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    });
  }

  // Upload to a temp QR path
  const ext = file.name.split(".").pop() || "jpg";
  const storagePath = `qr-upload/${token}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(COMMUNITY_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type || "image/jpeg", upsert: true });

  if (uploadError) {
    return { success: false, error: "Upload failed: " + uploadError.message };
  }

  const { data: urlData } = supabase.storage
    .from(COMMUNITY_BUCKET)
    .getPublicUrl(storagePath);

  const url = urlData.publicUrl;
  session.images.push({ url, storagePath, name: file.name });

  return { success: true, url };
}

// ── Get images uploaded to session (polled by desktop) ───────────────────
export async function getSessionImages(
  token: string
): Promise<{ images: { url: string; storagePath: string; name: string }[] }> {
  const session = sessions.get(token);
  if (!session) return { images: [] };
  return { images: session.images };
}

// ── Close/destroy session ────────────────────────────────────────────────
export async function closeUploadSession(token: string): Promise<void> {
  sessions.delete(token);
}
