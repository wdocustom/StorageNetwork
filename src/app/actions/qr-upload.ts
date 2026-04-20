"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { randomUUID } from "crypto";

const getSupabase = getServiceClient;

const COMMUNITY_BUCKET = "community-images";

// ── Create a new upload session ──────────────────────────────────────────
export async function createUploadSession(
  userId: string
): Promise<{ token: string }> {
  const token = randomUUID();

  const { error } = await getSupabase().from("qr_upload_sessions").insert({
    token,
    user_id: userId,
  });

  if (error) {
    console.error("[QR Upload] Failed to create session:", error);
    throw new Error("Failed to create upload session.");
  }

  return { token };
}

// ── Upload image to session (called from the mobile upload API) ──────────
export async function uploadToSession(
  token: string,
  formData: FormData
): Promise<{ success: boolean; error?: string; url?: string }> {
  // Verify session exists and is not expired
  const { data: session } = await getSupabase()
    .from("qr_upload_sessions")
    .select("token, user_id, expires_at")
    .eq("token", token)
    .single();

  if (!session) {
    return { success: false, error: "Session expired or invalid." };
  }

  if (new Date(session.expires_at) < new Date()) {
    return { success: false, error: "Upload session has expired." };
  }

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0)
    return { success: false, error: "No image provided." };

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
  ];
  if (file.type && !allowed.includes(file.type)) {
    return { success: false, error: "Invalid image type." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: "Image must be under 10MB." };
  }

  // Ensure bucket
  const { data: bucketData } = await getSupabase().storage.getBucket(
    COMMUNITY_BUCKET
  );
  if (!bucketData) {
    await getSupabase().storage.createBucket(COMMUNITY_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    });
  }

  // Upload to a temp QR path
  const ext = file.name.split(".").pop() || "jpg";
  const storagePath = `qr-upload/${token}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await getSupabase().storage
    .from(COMMUNITY_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    return { success: false, error: "Upload failed: " + uploadError.message };
  }

  const { data: urlData } = getSupabase().storage
    .from(COMMUNITY_BUCKET)
    .getPublicUrl(storagePath);

  const url = urlData.publicUrl;

  // Store image record in DB
  const { error: imgError } = await getSupabase()
    .from("qr_upload_images")
    .insert({
      session_token: token,
      url,
      storage_path: storagePath,
      name: file.name,
    });

  if (imgError) {
    console.error("[QR Upload] Failed to store image record:", imgError);
  }

  return { success: true, url };
}

// ── Get images uploaded to session (polled by desktop) ───────────────────
export async function getSessionImages(
  token: string
): Promise<{
  images: { url: string; storagePath: string; name: string }[];
}> {
  // Verify session exists
  const { data: session } = await getSupabase()
    .from("qr_upload_sessions")
    .select("token")
    .eq("token", token)
    .single();

  if (!session) return { images: [] };

  const { data: images } = await getSupabase()
    .from("qr_upload_images")
    .select("url, storage_path, name")
    .eq("session_token", token)
    .order("created_at", { ascending: true });

  return {
    images: (images || []).map((i) => ({
      url: i.url,
      storagePath: i.storage_path,
      name: i.name,
    })),
  };
}

// ── Close/destroy session ────────────────────────────────────────────────
export async function closeUploadSession(token: string): Promise<void> {
  // Cascade delete removes images too
  await getSupabase().from("qr_upload_sessions").delete().eq("token", token);
}
