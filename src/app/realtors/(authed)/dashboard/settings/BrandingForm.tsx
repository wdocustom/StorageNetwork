"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Check,
  AlertCircle,
} from "lucide-react";

import {
  uploadRealtorBrandingImage,
  clearRealtorBrandingImage,
  saveRealtorSignature,
  type RealtorBranding,
} from "@/app/actions/realtor-branding";

// ═══════════════════════════════════════════════════════════════════════════
// Branding form — photo + logo (file uploads) + signature (textarea).
//
// All three are independent: photo upload doesn't touch logo or signature.
// Each section maintains its own pending / success / error state so the
// user can see exactly which save just landed.
// ═══════════════════════════════════════════════════════════════════════════

const SIGNATURE_MAX_LEN = 500;

export function BrandingForm({ initial }: { initial: RealtorBranding | null }) {
  const router = useRouter();

  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photoUrl ?? null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial?.logoUrl ?? null);
  const [signature, setSignature] = useState(initial?.signature ?? "");

  return (
    <div className="space-y-6">
      <ImageUploadCard
        kind="photo"
        title="Your photo"
        description="A friendly head-shot. Appears as a circular avatar on the recipient's gift page."
        icon={<Camera className="h-5 w-5 text-yellow-400" />}
        currentUrl={photoUrl}
        onChange={setPhotoUrl}
        previewClassName="h-24 w-24 rounded-full"
      />

      <ImageUploadCard
        kind="logo"
        title="Brokerage logo"
        description="Square or wide logo. Rendered alongside your brokerage name."
        icon={<ImageIcon className="h-5 w-5 text-yellow-400" />}
        currentUrl={logoUrl}
        onChange={setLogoUrl}
        previewClassName="h-20 w-32 rounded-lg object-contain bg-slate-800/40 p-2"
      />

      <SignatureCard
        initial={signature}
        onChange={setSignature}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

// ── Image upload card (used for both photo and logo) ──────────────────────

function ImageUploadCard({
  kind,
  title,
  description,
  icon,
  currentUrl,
  onChange,
  previewClassName,
}: {
  kind: "photo" | "logo";
  title: string;
  description: string;
  icon: React.ReactNode;
  currentUrl: string | null;
  onChange: (url: string | null) => void;
  previewClassName: string;
}) {
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
      const result = await uploadRealtorBrandingImage(kind, fd);
      if (!result.ok) {
        setError(result.error ?? "Upload failed.");
        return;
      }
      onChange(result.url ?? null);
      fireFlash();
    });
  }

  function handleClear() {
    setError(null);
    startTransition(async () => {
      const result = await clearRealtorBrandingImage(kind);
      if (!result.ok) {
        setError(result.error ?? "Could not clear.");
        return;
      }
      onChange(null);
      fireFlash();
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-lg bg-slate-950/60 p-2 ring-1 ring-slate-800">{icon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-300">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">{description}</p>
        </div>
        {savedFlash && (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
            <Check className="h-3 w-3" />
            Saved
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={title}
            className={`${previewClassName} border border-slate-800`}
          />
        ) : (
          <div
            className={`${previewClassName} flex items-center justify-center border border-dashed border-slate-700 bg-slate-950/30 text-[10px] uppercase tracking-wider text-stone-600`}
          >
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
            {currentUrl ? "Replace" : "Upload"}
          </button>
          {currentUrl && (
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

// ── Signature card ─────────────────────────────────────────────────────────

function SignatureCard({
  initial,
  onChange,
  onSaved,
}: {
  initial: string;
  onChange: (value: string) => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const overLimit = value.length > SIGNATURE_MAX_LEN;
  const dirty = value !== initial;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveRealtorSignature(value);
      if (!result.ok) {
        setError(result.error ?? "Save failed.");
        return;
      }
      onChange(value);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      onSaved();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-lg bg-slate-950/60 p-2 ring-1 ring-slate-800">
          <ImageIcon className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-300">
            Default signature
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Shows on the recipient&apos;s gift page when you don&apos;t supply a per-gift personal
            message. A great place for a thank-you line, your phone number, or a closing wish.
          </p>
        </div>
        {savedFlash && (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
            <Check className="h-3 w-3" />
            Saved
          </span>
        )}
      </div>

      <textarea
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Thanks for trusting me with your move. Call any time — Sky"
        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
      />

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className={overLimit ? "text-red-300" : "text-stone-500"}>
          {value.length}/{SIGNATURE_MAX_LEN}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || overLimit || !dirty}
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save signature
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </section>
  );
}
