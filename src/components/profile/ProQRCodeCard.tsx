"use client";

import { useCallback, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Check, Copy, Download, Image as ImageIcon, QrCode, X } from "lucide-react";
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
  const [downloadingCard, setDownloadingCard] = useState(false);

  // Construct the full profile URL
  const profileUrl = `${siteConfig.baseUrl}/p/${slug}`;
  const shortUrl = `storage-network.app/p/${slug}`;

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

      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new window.Image();

      img.onload = () => {
        const scale = 4;
        const size = 256;
        canvas.width = size * scale;
        canvas.height = size * scale;

        if (ctx) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

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

  // Download branded share card (1080x1350 — optimized for FB/IG posts)
  const handleDownloadShareCard = useCallback(async () => {
    if (!qrRef.current) return;

    setDownloadingCard(true);

    try {
      const svg = qrRef.current.querySelector("svg");
      if (!svg) throw new Error("SVG not found");

      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const qrImg = new window.Image();

      qrImg.onload = () => {
        const W = 1080;
        const H = 1350;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) { setDownloadingCard(false); return; }

        // ── Background: dark slate gradient ──
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#0f172a");   // slate-900
        grad.addColorStop(1, "#020617");   // slate-950
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // ── Top accent bar ──
        ctx.fillStyle = "#facc15"; // yellow-400
        ctx.fillRect(0, 0, W, 6);

        // ── Business name ──
        const displayName = businessName || slug;
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 52px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(displayName, W / 2, 120, W - 120);

        // ── Headline ──
        ctx.fillStyle = "#94a3b8"; // stone-400
        ctx.font = "32px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillText("Design & Price Your", W / 2, 200);
        ctx.fillText("Garage Storage System", W / 2, 244);

        // ── Divider line ──
        ctx.strokeStyle = "#334155"; // slate-700
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W * 0.2, 300);
        ctx.lineTo(W * 0.8, 300);
        ctx.stroke();

        // ── QR code (centered, on white card) ──
        const qrSize = 420;
        const qrPadding = 40;
        const cardSize = qrSize + qrPadding * 2;
        const cardX = (W - cardSize) / 2;
        const cardY = 340;

        // White rounded card behind QR
        ctx.fillStyle = "#FFFFFF";
        const r = 24;
        ctx.beginPath();
        ctx.moveTo(cardX + r, cardY);
        ctx.lineTo(cardX + cardSize - r, cardY);
        ctx.arcTo(cardX + cardSize, cardY, cardX + cardSize, cardY + r, r);
        ctx.lineTo(cardX + cardSize, cardY + cardSize - r);
        ctx.arcTo(cardX + cardSize, cardY + cardSize, cardX + cardSize - r, cardY + cardSize, r);
        ctx.lineTo(cardX + r, cardY + cardSize);
        ctx.arcTo(cardX, cardY + cardSize, cardX, cardY + cardSize - r, r);
        ctx.lineTo(cardX, cardY + r);
        ctx.arcTo(cardX, cardY, cardX + r, cardY, r);
        ctx.closePath();
        ctx.fill();

        // Draw QR code inside white card
        ctx.drawImage(qrImg, cardX + qrPadding, cardY + qrPadding, qrSize, qrSize);

        // ── "Scan or visit" label ──
        const belowCard = cardY + cardSize + 50;
        ctx.fillStyle = "#64748b"; // slate-500
        ctx.font = "26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillText("Scan the code or visit:", W / 2, belowCard);

        // ── URL (large, yellow, readable) ──
        ctx.fillStyle = "#facc15"; // yellow-400
        ctx.font = "bold 38px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillText(shortUrl, W / 2, belowCard + 56);

        // ── Bottom divider ──
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W * 0.15, H - 160);
        ctx.lineTo(W * 0.85, H - 160);
        ctx.stroke();

        // ── Bottom tagline ──
        ctx.fillStyle = "#94a3b8";
        ctx.font = "24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillText("Free 3D Preview  \u2022  Instant Pricing  \u2022  Book Online", W / 2, H - 105);

        // ── Powered by line ──
        ctx.fillStyle = "#475569"; // slate-600
        ctx.font = "20px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillText("Powered by The Storage-Network", W / 2, H - 55);

        // ── Download ──
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.download = `${slug}-share-card.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
          }
          setDownloadingCard(false);
        }, "image/png", 1.0);

        URL.revokeObjectURL(svgUrl);
      };

      qrImg.onerror = () => {
        console.error("Failed to load QR SVG for share card");
        setDownloadingCard(false);
        URL.revokeObjectURL(svgUrl);
      };

      qrImg.src = svgUrl;
    } catch (err) {
      console.error("Share card download failed:", err);
      setDownloadingCard(false);
    }
  }, [slug, businessName, shortUrl]);

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
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {downloading ? "Saving..." : "QR Only"}
              </button>
            </div>

            {/* Share Card Download — branded image for social media */}
            <button
              onClick={handleDownloadShareCard}
              disabled={downloadingCard}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-50"
            >
              <ImageIcon className="h-4 w-4" />
              {downloadingCard ? "Generating..." : "Download Share Card for Facebook"}
            </button>
            <p className="mt-1.5 text-center text-[10px] text-stone-600">
              Branded image with QR code + readable URL — perfect for posts where links don&apos;t work
            </p>
          </div>
        </div>
      )}
    </>
  );
}
