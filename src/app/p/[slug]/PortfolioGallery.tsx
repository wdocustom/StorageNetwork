"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Portfolio Gallery — Interactive photo grid with lightbox
// ═══════════════════════════════════════════════════════════════════════════

interface PortfolioPhoto {
  url: string;
  caption?: string;
}

interface PortfolioGalleryProps {
  photos: PortfolioPhoto[];
  businessName: string;
}

export default function PortfolioGallery({ photos, businessName }: PortfolioGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const goNext = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % photos.length);
  }, [lightboxIndex, photos.length]);

  const goPrev = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length);
  }, [lightboxIndex, photos.length]);

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [lightboxIndex, goNext, goPrev]);

  if (photos.length === 0) return null;

  return (
    <>
      {/* Photo Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {photos.map((photo, i) => (
          <button
            key={photo.url}
            onClick={() => openLightbox(i)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800 transition-all hover:border-yellow-400/50 hover:shadow-lg hover:shadow-yellow-400/5 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
          >
            <Image
              src={photo.url}
              alt={photo.caption || `${businessName} project ${i + 1}`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, 33vw"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            {photo.caption && (
              <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="text-xs font-medium text-white drop-shadow-lg line-clamp-2">
                  {photo.caption}
                </p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Counter */}
          <div className="absolute left-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white/70">
            {lightboxIndex + 1} / {photos.length}
          </div>

          {/* Previous */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-2 z-10 rounded-full bg-black/50 p-2 text-white/80 transition-colors hover:bg-black/70 hover:text-white sm:left-4"
            >
              <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
            </button>
          )}

          {/* Image */}
          <div
            className="relative mx-12 max-h-[85vh] max-w-[90vw] sm:mx-20 sm:max-w-[80vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={photos[lightboxIndex].url}
              alt={photos[lightboxIndex].caption || `Photo ${lightboxIndex + 1}`}
              width={1200}
              height={900}
              className="max-h-[85vh] rounded-lg object-contain"
              unoptimized
            />
            {photos[lightboxIndex].caption && (
              <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-gradient-to-t from-black/80 to-transparent p-4 pt-8">
                <p className="text-center text-sm font-medium text-white">
                  {photos[lightboxIndex].caption}
                </p>
              </div>
            )}
          </div>

          {/* Next */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-2 z-10 rounded-full bg-black/50 p-2 text-white/80 transition-colors hover:bg-black/70 hover:text-white sm:right-4"
            >
              <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
