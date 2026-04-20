"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import {
  Smartphone,
  X,
  Loader2,
  Check,
  ScanLine,
} from "lucide-react";
import {
  createUploadSession,
  closeUploadSession,
} from "@/app/actions/qr-upload";

// ═══════════════════════════════════════════════════════════════════════════
// QR Photo Upload — Desktop-only component
//
// Shows a QR code that links to a mobile upload page. Polls for new images
// uploaded from the phone and passes them back to the parent via callback.
// Only rendered when the user agent is NOT a mobile device.
// ═══════════════════════════════════════════════════════════════════════════

interface QRPhotoUploadProps {
  userId: string;
  onImagesReceived: (images: { url: string; name: string; storagePath?: string }[]) => void;
}

export default function QRPhotoUpload({
  userId,
  onImagesReceived,
}: QRPhotoUploadProps) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [receivedCount, setReceivedCount] = useState(0);
  const knownUrls = useRef(new Set<string>());
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Detect if user is on mobile — if so, don't render at all
  const [isMobile, setIsMobile] = useState(true); // default true to avoid flash
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const mobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    // Also check screen width as backup
    const smallScreen = window.innerWidth < 1024;
    setIsMobile(mobile || smallScreen);
  }, []);

  const startSession = useCallback(async () => {
    setLoading(true);
    const { token: newToken } = await createUploadSession(userId);
    setToken(newToken);
    knownUrls.current.clear();
    setReceivedCount(0);
    setLoading(false);
  }, [userId]);

  // Poll for new images when session is active
  useEffect(() => {
    if (!token || !open) return;

    async function poll() {
      try {
        const res = await fetch(`/api/community/qr-upload?token=${token}`);
        const data = await res.json();
        if (data.images && data.images.length > 0) {
          const newImages = data.images.filter(
            (img: { url: string }) => !knownUrls.current.has(img.url)
          );
          if (newImages.length > 0) {
            for (const img of newImages) {
              knownUrls.current.add(img.url);
            }
            setReceivedCount(knownUrls.current.size);
            onImagesReceived(newImages);
          }
        }
      } catch {
        // Silently retry
      }
    }

    // Poll every 2 seconds
    poll();
    pollRef.current = setInterval(poll, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [token, open, onImagesReceived]);

  function handleOpen() {
    setOpen(true);
    startSession();
  }

  function handleClose() {
    setOpen(false);
    if (pollRef.current) clearInterval(pollRef.current);
    if (token) closeUploadSession(token);
    setToken(null);
    knownUrls.current.clear();
    setReceivedCount(0);
  }

  // Don't render on mobile
  if (isMobile) return null;

  const uploadUrl = token
    ? `${window.location.origin}/upload?token=${token}`
    : "";

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-800/30 px-3 py-2.5 text-xs text-stone-400 transition-colors hover:border-yellow-400/30 hover:text-stone-300"
      >
        <Smartphone className="h-3.5 w-3.5" />
        Upload from Phone via QR
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-yellow-500/20 bg-slate-900 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">
            Scan to Upload from Phone
          </span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
        </div>
      ) : (
        <div className="flex gap-4">
          {/* QR Code */}
          <div className="flex-shrink-0 rounded-xl bg-white p-3">
            <QRCode
              value={uploadUrl}
              size={140}
              level="H"
              bgColor="#FFFFFF"
              fgColor="#1e293b"
            />
          </div>

          {/* Instructions */}
          <div className="flex flex-1 flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-stone-300">
                Open your phone camera and scan this code
              </p>
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                Select photos on your phone — they&apos;ll appear here automatically. No app needed.
              </p>
            </div>

            {/* Status */}
            <div className="mt-3 flex items-center gap-2">
              {receivedCount > 0 ? (
                <>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-emerald-400">
                    {receivedCount} photo{receivedCount !== 1 ? "s" : ""} received
                  </span>
                </>
              ) : (
                <>
                  <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                  <span className="text-xs text-stone-500">Waiting for photos...</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
