"use server";
import { getServiceClient } from "@/lib/supabase-server";


// ═══════════════════════════════════════════════════════════════════════════
// Photo Upload — Server action using service role key
// Ensures the job-photos bucket exists and handles upload server-side.
// ═══════════════════════════════════════════════════════════════════════════


const BUCKET = "job-photos";

/** Ensure the storage bucket exists (idempotent) */
async function ensureBucket() {
  const { data } = await getServiceClient().storage.getBucket(BUCKET);
  if (!data) {
    await getServiceClient().storage.createBucket(BUCKET, {
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

    const { error: uploadError } = await getServiceClient().storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[PhotoUpload] Upload error:", uploadError);
      return { success: false, error: uploadError.message };
    }

    const { data: urlData } = getServiceClient().storage
      .from(BUCKET)
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    // Save photo URL to lead record
    await getServiceClient()
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
