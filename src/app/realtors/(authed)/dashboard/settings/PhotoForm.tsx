"use client";

import { useRef, useState, useTransition } from "react";
import {
  Camera,
  Loader2,
  Trash2,
  Check,
  AlertCircle,
} from "lucide-react";

import {
  uploadRealtorPhoto,
  clearRealtorPhoto,
  type RealtorPhoto,
} from "@/app/actions/realtor-photo";

// ═══════════════════════════════════════════════════════════════════════════
// Photo upload form — single asset, circular preview.
// ═══════════════════════════════════════════════════════════════════════════

export function PhotoForm({ initial }: { initial: RealtorPhoto | null }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photoUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  function fireFlash() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  function handleFile(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const result = await uploadRealtorPhoto(fd);
      if (!result.ok) {
        setError(result.error ?? "Upload failed.");
        return;
      }
      setPhotoUrl(result.url ?? null);
      fireFlash();
    });
  }

  function handleClear() {
    setError(null);
    startTransition(async () => {
      const result = await clearRealtorPhoto();
      if (!result.ok) {
        setError(result.error ?? "Could not clear.");
        return;
      }
      setPhotoUrl(null);
      fireFlash();
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-lg bg-slate-950/60 p-2 ring-1 ring-slate-800">
          <Camera className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-300">
            Your photo
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            A friendly head-shot. Appears on the gift email your recipient sees and on the gift page they land on.
          </p>
        </div>
        {savedFlash && (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
            <Check className="h-3 w-3" />
            Saved
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt="Your photo"
            className="h-24 w-24 rounded-full border border-slate-800 object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-slate-700 bg-slate-950/30 text-[10px] uppercase tracking-wider text-stone-600">
            None
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-yellow-300 hover:bg-yellow-400/20 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            {photoUrl ? "Replace" : "Upload"}
          </button>
          {photoUrl && (
            <button
              type="button"
              onClick={handleClear}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-stone-300 hover:bg-slate-800 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <p className="mt-3 text-[11px] text-stone-500">
        PNG, JPG, WEBP, or GIF. Max 5 MB.
      </p>
    </section>
  );
}
