"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import {
  Camera,
  ExternalLink,
  Instagram,
  Facebook,
  Loader2,
  Save,
  Trash2,
  X,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  updatePortfolioSettings,
  uploadPortfolioPhoto,
  deletePortfolioPhoto,
  type PortfolioPhoto,
} from "@/app/actions/profile";

// ═══════════════════════════════════════════════════════════════════════════
// Portfolio Section — Manage bio, social links, and portfolio photos
// Renders inside the dashboard profile page
// ═══════════════════════════════════════════════════════════════════════════

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/** Resize + compress an image file client-side before uploading. */
function compressImage(file: File): Promise<{ base64: string; ext: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Scale down if either dimension exceeds the cap
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);

      // Always output as JPEG for consistent compression
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, ext: "jpg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

interface PortfolioSectionProps {
  userId: string;
  slug: string | null;
  initialBio: string;
  initialInstagram: string;
  initialFacebook: string;
  initialPhotos: PortfolioPhoto[];
  businessName?: string;
  firstName?: string;
  city?: string;
  state?: string;
}

export default function PortfolioSection({
  userId,
  slug,
  initialBio,
  initialInstagram,
  initialFacebook,
  initialPhotos,
  businessName,
  firstName,
  city,
  state,
}: PortfolioSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [bio, setBio] = useState(initialBio);
  const [instagramUrl, setInstagramUrl] = useState(initialInstagram);
  const [facebookUrl, setFacebookUrl] = useState(initialFacebook);
  const [photos, setPhotos] = useState<PortfolioPhoto[]>(initialPhotos);

  // UI state
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [generatingBio, setGeneratingBio] = useState(false);

  // Save bio & social links
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMessage("");

    const result = await updatePortfolioSettings({
      user_id: userId,
      bio: bio || "",
      instagram_url: instagramUrl || "",
      facebook_url: facebookUrl || "",
    });

    if (result.success) {
      setSaveMessage("Portfolio settings saved!");
      setTimeout(() => setSaveMessage(""), 3000);
    } else {
      setSaveMessage(result.error || "Failed to save.");
    }

    setSaving(false);
  }, [userId, bio, instagramUrl, facebookUrl]);

  // Generate bio with AI
  const handleGenerateBio = useCallback(async () => {
    setGeneratingBio(true);
    setSaveMessage("");

    try {
      const res = await fetch("/api/profile/generate-bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          firstName,
          city,
          state,
          existingBio: bio.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveMessage(data.error || "Failed to generate bio.");
      } else if (data.bio) {
        setBio(data.bio);
        setSaveMessage("AI bio generated! Review and save when ready.");
        setTimeout(() => setSaveMessage(""), 4000);
      }
    } catch {
      setSaveMessage("Failed to connect to AI service.");
    } finally {
      setGeneratingBio(false);
    }
  }, [businessName, firstName, city, state, bio]);

  // Upload photo (compresses client-side before sending to server action)
  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!validTypes.includes(file.type)) {
        setSaveMessage("Please upload a JPG, PNG, GIF, or WebP image.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setSaveMessage("Image must be less than 10MB.");
        return;
      }

      setUploading(true);
      setSaveMessage("");

      try {
        // Compress image client-side (resize to 1600px max, JPEG @ 82%)
        const { base64, ext } = await compressImage(file);

        const result = await uploadPortfolioPhoto(userId, base64, ext);

        if (result.success && result.photo) {
          setPhotos((prev) => [...prev, result.photo!]);
          setSaveMessage("Photo added!");
          setTimeout(() => setSaveMessage(""), 3000);
        } else {
          setSaveMessage(result.error || "Failed to upload photo.");
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to upload photo.";
        setSaveMessage(`Upload error: ${msg}`);
      } finally {
        setUploading(false);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [userId]
  );

  // Delete photo
  const handleDeletePhoto = useCallback(
    async (photoUrl: string) => {
      setDeletingUrl(photoUrl);

      const result = await deletePortfolioPhoto(userId, photoUrl);

      if (result.success) {
        setPhotos((prev) => prev.filter((p) => p.url !== photoUrl));
      } else {
        setSaveMessage(result.error || "Failed to delete photo.");
      }

      setDeletingUrl(null);
    },
    [userId]
  );

  const portfolioUrl = slug ? `/p/${slug}` : null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-yellow-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
            Portfolio & Social
          </h2>
        </div>
        {portfolioUrl && (
          <a
            href={portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-yellow-400 transition-colors hover:bg-slate-700"
          >
            <ExternalLink className="h-3 w-3" />
            Preview
          </a>
        )}
      </div>

      <p className="mb-4 text-xs text-stone-500">
        Customize your public portfolio page. Customers who scan your QR code
        or click your link will see this information.
      </p>

      {/* Bio */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
            <FileText className="h-3 w-3" />
            About / Bio
          </label>
          <button
            type="button"
            onClick={handleGenerateBio}
            disabled={generatingBio}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[10px] font-bold text-purple-400 transition-all hover:border-purple-500/50 hover:bg-purple-500/20 disabled:opacity-50"
          >
            {generatingBio ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {generatingBio ? "Writing..." : "Write My Bio with AI"}
          </button>
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell potential customers about your business, experience, and what makes you different..."
          rows={3}
          maxLength={280}
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
        />
        <p className="mt-0.5 text-right text-[10px] text-stone-600">
          {bio.length}/280
        </p>
      </div>

      {/* Social Links */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
            <Instagram className="h-3 w-3" />
            Instagram
          </label>
          <input
            type="text"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="@yourbusiness or full URL"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
          />
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
            <Facebook className="h-3 w-3" />
            Facebook
          </label>
          <input
            type="text"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            placeholder="Page name or full URL"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
          />
        </div>
      </div>

      {/* Save Settings Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="mb-5 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saving ? "Saving..." : "Save Portfolio Settings"}
      </button>

      {/* Divider */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-700/50" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600">
          Portfolio Photos
        </span>
        <div className="h-px flex-1 bg-slate-700/50" />
      </div>

      {/* Photo Grid */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div
            key={photo.url}
            className="group relative aspect-square overflow-hidden rounded-lg border border-slate-700 bg-slate-800"
          >
            <Image
              src={photo.url}
              alt={photo.caption || "Portfolio photo"}
              fill
              className="object-cover"
              sizes="120px"
              unoptimized
            />
            {/* Delete overlay */}
            <button
              onClick={() => handleDeletePhoto(photo.url)}
              disabled={deletingUrl === photo.url}
              className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
            >
              {deletingUrl === photo.url ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Trash2 className="h-5 w-5 text-red-400" />
              )}
            </button>
          </div>
        ))}

        {/* Add Photo button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/30 text-stone-500 transition-all hover:border-yellow-400/50 hover:text-yellow-400 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Camera className="h-5 w-5" />
              <span className="text-[10px] font-bold">Add</span>
            </div>
          )}
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      <p className="text-[10px] text-stone-600">
        Upload photos of your completed installations. JPG, PNG, or WebP up to 10MB each.
      </p>

      {/* Status Message */}
      {saveMessage && (
        <p
          className={`mt-3 text-center text-xs font-medium ${
            saveMessage.includes("Failed") || saveMessage.includes("must")
              ? "text-red-400"
              : "text-emerald-400"
          }`}
        >
          {saveMessage}
        </p>
      )}
    </section>
  );
}
