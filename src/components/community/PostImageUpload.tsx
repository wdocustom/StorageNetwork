"use client";

import { useState } from "react";
import { ImagePlus, X, AlertCircle } from "lucide-react";

export interface StagedImage {
  file: File;
  preview: string;
}

interface PostImageUploadProps {
  stagedImages: StagedImage[];
  onStagedImagesChange: (images: StagedImage[]) => void;
  maxImages?: number;
}

export default function PostImageUpload({
  stagedImages,
  onStagedImagesChange,
  maxImages = 6,
}: PostImageUploadProps) {
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function validateAndStage(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const remaining = maxImages - stagedImages.length;

    if (remaining <= 0) {
      setError(`Maximum ${maxImages} images allowed.`);
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const maxSize = 5 * 1024 * 1024;
    const newStaged: StagedImage[] = [];

    for (const file of fileArray.slice(0, remaining)) {
      if (!allowed.includes(file.type)) {
        setError("Only JPEG, PNG, WebP, and GIF images are allowed.");
        continue;
      }
      if (file.size > maxSize) {
        setError("Each image must be under 5MB.");
        continue;
      }
      newStaged.push({ file, preview: URL.createObjectURL(file) });
    }

    if (newStaged.length > 0) {
      setError("");
      onStagedImagesChange([...stagedImages, ...newStaged]);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      validateAndStage(e.dataTransfer.files);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      validateAndStage(e.target.files);
      e.target.value = "";
    }
  }

  function handleRemove(index: number) {
    const updated = [...stagedImages];
    URL.revokeObjectURL(updated[index].preview);
    updated.splice(index, 1);
    onStagedImagesChange(updated);
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-400">
        Photos ({stagedImages.length}/{maxImages})
      </label>

      {/* Thumbnail grid */}
      {stagedImages.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {stagedImages.map((img, i) => (
            <div
              key={i}
              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-700"
            >
              <img
                src={img.preview}
                alt={`Upload ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {stagedImages.length < maxImages && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
            dragOver
              ? "border-yellow-400 bg-yellow-400/5"
              : "border-slate-700 hover:border-slate-600"
          }`}
          onClick={() =>
            document.getElementById("post-image-input")?.click()
          }
        >
          <ImagePlus className="mb-1.5 h-6 w-6 text-stone-500" />
          <p className="text-xs text-stone-400">
            Drop images here or click to browse
          </p>
          <p className="mt-0.5 text-[10px] text-stone-600">
            JPEG, PNG, WebP, GIF up to 5MB each
          </p>
        </div>
      )}

      <input
        id="post-image-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      {error && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}
    </div>
  );
}
