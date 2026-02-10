"use client";

import { useCallback, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Check, Copy, Download, QrCode } from "lucide-react";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Pro QR Code Card — Generate QR codes for installer profile links
// Exclusive to Pro subscribers
// ═══════════════════════════════════════════════════════════════════════════

interface ProQRCodeCardProps {
  slug: string;
  businessName?: string;
}

export default function ProQRCodeCard({ slug, businessName }: ProQRCodeCardProps) {
  const qrRef = useRef<HTMLDivElement>(null);
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
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center gap-2">
        <QrCode className="h-4 w-4 text-yellow-400" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Partner QR Code
        </h2>
        <span className="ml-auto rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
          PRO
        </span>
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
          Your Partner Link
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

      {/* Usage Tips */}
      <div className="mt-4 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
          How to use your QR code
        </p>
        <ul className="space-y-1 text-xs text-stone-400">
          <li>• Print on business cards or flyers</li>
          <li>• Display at job sites and showrooms</li>
          <li>• Add to your vehicle wrap or signage</li>
          <li>• Share in social media posts</li>
        </ul>
      </div>
    </section>
  );
}
