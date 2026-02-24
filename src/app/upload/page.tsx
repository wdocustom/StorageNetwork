"use client";

import { useRef, useState, useEffect } from "react";
import { Camera, Check, Loader2, Upload, X, ImagePlus } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Mobile QR Upload Page
//
// Opened on a phone after scanning the QR code from the desktop community
// post editor. Uploads photos directly to the session — the desktop polls
// for new images and shows them in real time.
// ═══════════════════════════════════════════════════════════════════════════

interface UploadedImage {
  url: string;
  name: string;
}

export default function MobileUploadPage() {
  const [token, setToken] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || !token) return;
    setError("");
    setUploading(true);

    const newUploads: UploadedImage[] = [];

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.set("token", token);
        formData.set("image", file);

        const res = await fetch("/api/community/qr-upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (data.success && data.url) {
          newUploads.push({ url: data.url, name: file.name });
        } else {
          setError(data.error || "Upload failed.");
        }
      } catch {
        setError("Network error. Please try again.");
      }
    }

    setUploads((prev) => [...prev, ...newUploads]);
    setUploading(false);
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <p className="text-lg font-bold text-white">Invalid Upload Link</p>
          <p className="mt-2 text-sm text-stone-400">
            This link is expired or invalid. Scan a new QR code from your desktop.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-white">Photos Sent!</p>
          <p className="mt-2 text-sm text-stone-400">
            {uploads.length} photo{uploads.length !== 1 ? "s" : ""} uploaded. Head back to your computer to continue your post.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900 px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <Camera className="h-5 w-5 text-yellow-400" />
          <h1 className="text-sm font-bold uppercase tracking-wider text-white">
            Upload Photos
          </h1>
        </div>
        <p className="mt-1 text-[11px] text-stone-500">
          Photos will appear on your desktop automatically
        </p>
      </div>

      <div className="mx-auto max-w-md space-y-4 p-4">
        {/* Upload zone */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 px-6 py-12 transition-colors active:border-yellow-400 active:bg-yellow-400/5 disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-yellow-400" />
              <p className="text-sm font-bold text-white">Uploading...</p>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-400/10">
                <ImagePlus className="h-8 w-8 text-yellow-400" />
              </div>
              <p className="text-sm font-bold text-white">Tap to Select Photos</p>
              <p className="text-xs text-stone-500">
                JPEG, PNG, WebP, GIF up to 10MB each
              </p>
            </>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
            <p className="text-xs font-medium text-red-400">{error}</p>
          </div>
        )}

        {/* Uploaded thumbnails */}
        {uploads.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
              Uploaded ({uploads.length})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {uploads.map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-lg border border-slate-700"
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute right-1 top-1 rounded-full bg-emerald-500 p-0.5">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Done button */}
        {uploads.length > 0 && !uploading && (
          <button
            onClick={() => setDone(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-bold text-gray-950 transition-colors active:bg-yellow-300"
          >
            <Upload className="h-4 w-4" />
            Done — Return to Desktop
          </button>
        )}

        {/* Add more */}
        {uploads.length > 0 && !uploading && (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 py-3 text-sm font-medium text-stone-300 transition-colors active:bg-slate-800"
          >
            <ImagePlus className="h-4 w-4" />
            Add More Photos
          </button>
        )}
      </div>
    </div>
  );
}
