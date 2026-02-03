"use server";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Photo Upload — Server action using service role key
// Ensures the job-photos bucket exists and handles upload server-side.
// ═══════════════════════════════════════════════════════════════════════════

// Lazy-initialize Supabase client to avoid build-time errors
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase environment variables not configured");
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

const BUCKET = "job-photos";

/** Ensure the storage bucket exists (idempotent) */
async function ensureBucket() {
  const { data } = await getSupabase().storage.getBucket(BUCKET);
  if (!data) {
    await getSupabase().storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
    });
  }
}

export interface PhotoUploadResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
}

export async function uploadJobPhoto(
  leadId: string,
  formData: FormData
): Promise<PhotoUploadResult> {
  try {
    const file = formData.get("photo") as File | null;
    if (!file) {
      return { success: false, error: "No file provided." };
    }

    await ensureBucket();

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${leadId}/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await getSupabase().storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[PhotoUpload] Upload error:", uploadError);
      return { success: false, error: uploadError.message };
    }

    const { data: urlData } = getSupabase().storage
      .from(BUCKET)
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    // Save photo URL to lead record
    await getSupabase()
      .from("leads")
      .update({ photo_url: publicUrl })
      .eq("id", leadId);

    return { success: true, publicUrl };
  } catch (err) {
    console.error("[PhotoUpload] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}
