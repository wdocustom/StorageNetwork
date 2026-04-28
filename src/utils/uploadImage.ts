import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const BUCKET = "build-snapshots";

export async function uploadBuildSnapshot(blob: Blob): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const fileName = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, blob, { contentType: "image/png", upsert: false });

  if (error) {
    console.error("[uploadBuildSnapshot] Upload failed:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}
