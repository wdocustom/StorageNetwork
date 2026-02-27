"use client";

import { useCallback, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Check, Copy, Download, QrCode, X } from "lucide-react";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Pro QR Code Card — Opens as a modal overlay from a trigger button
// Exclusive to Pro subscribers
// ═══════════════════════════════════════════════════════════════════════════

interface ProQRCodeCardProps {
  slug: string;
  businessName?: string;
}

export default function ProQRCodeCard({ slug, businessName }: ProQRCodeCardProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Construct the full profile URL
  const profileUrl = `${siteConfig.baseUrl}/p/${slug}`;

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [profileUrl]);

  // Download QR code as PNG
  const handleDownload = useCallback(async () => {
    if (!qrRef.current) return;

    setDownloading(true);

    try {
      const svg = qrRef.current.querySelector("svg");
      if (!svg) throw new Error("SVG not found");

      // Get SVG dimensions
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      // Create high-res canvas (4x for crisp output)
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        // Set canvas size (high resolution)
        const scale = 4;
        const size = 256;
        canvas.width = size * scale;
        canvas.height = size * scale;

        if (ctx) {
          // White background
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw QR code
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Convert to PNG and download
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.download = `storage-network-qr-${slug}.png`;
              link.href = url;
              link.click();
              URL.revokeObjectURL(url);
            }
            setDownloading(false);
          }, "image/png", 1.0);
        }

        URL.revokeObjectURL(svgUrl);
      };

      img.onerror = () => {
        console.error("Failed to load SVG for conversion");
        setDownloading(false);
        URL.revokeObjectURL(svgUrl);
      };

      img.src = svgUrl;
    } catch (err) {
      console.error("Download failed:", err);
      setDownloading(false);
    }
  }, [slug]);

  return (
    <>
      {/* Trigger Button — compact tile in the quick-access bar */}
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-stone-400 transition-all hover:border-yellow-400/40 hover:text-yellow-400"
      >
        <QrCode className="h-5 w-5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">QR Code</span>
      </button>

      {/* Modal Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-yellow-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Your QR Code
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* QR Code Display */}
            <div className="mb-4 flex justify-center">
              <div
                ref={qrRef}
                className="rounded-xl bg-white p-4 shadow-lg"
              >
                <QRCode
                  value={profileUrl}
                  size={180}
                  level="H"
                  bgColor="#FFFFFF"
                  fgColor="#1e293b"
                />
              </div>
            </div>

            {/* Profile URL Display */}
            <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Your Portfolio Link
              </p>
              <p className="break-all text-sm font-medium text-yellow-400">
                {profileUrl}
              </p>
              {businessName && (
                <p className="mt-1 text-xs text-stone-500">
                  Customers who scan this code will see your branded booking page
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-700"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {downloading ? "Saving..." : "Download PNG"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
