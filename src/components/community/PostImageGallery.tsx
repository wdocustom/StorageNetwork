"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { PostImage } from "@/app/actions/community";

interface PostImageGalleryProps {
  images: PostImage[];
}

export default function PostImageGallery({ images }: PostImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);

  function openLightbox(index: number) {
    setLightboxIndex(index);
  }

  function closeLightbox() {
    setLightboxIndex(null);
  }

  function prev() {
    setLightboxIndex((i) =>
      i !== null ? (i - 1 + sorted.length) % sorted.length : null
    );
  }

  function next() {
    setLightboxIndex((i) =>
      i !== null ? (i + 1) % sorted.length : null
    );
  }

  return (
    <>
      {/* Thumbnail grid */}
      <div
        className={`mt-4 grid gap-2 ${
          sorted.length === 1
            ? "grid-cols-1"
            : sorted.length === 2
              ? "grid-cols-2"
              : "grid-cols-3"
        }`}
      >
        {sorted.map((img, i) => (
          <button
            key={img.id}
            onClick={() => openLightbox(i)}
            className={`group relative overflow-hidden rounded-lg border border-slate-700 transition-all hover:border-slate-500 ${
              sorted.length === 1 ? "max-h-96" : "aspect-square"
            }`}
          >
            <img
              src={img.image_url}
              alt={img.caption || "Post image"}
              className={`w-full object-cover transition-transform group-hover:scale-105 ${
                sorted.length === 1 ? "max-h-96" : "h-full"
              }`}
            />
            {sorted.length > 1 && (
              <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/80"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Counter */}
          {sorted.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
              {lightboxIndex + 1} / {sorted.length}
            </div>
          )}

          {/* Navigation */}
          {sorted.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/80"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/80"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Image */}
          <img
            src={sorted[lightboxIndex].image_url}
            alt={sorted[lightboxIndex].caption || "Post image"}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Caption */}
          {sorted[lightboxIndex].caption && (
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-sm text-white">
              {sorted[lightboxIndex].caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}
