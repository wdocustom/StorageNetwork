"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getRackByToken, type InventoryRack } from "@/app/actions/tote-inventory";
import { Loader2, Printer } from "lucide-react";
import QRCode from "react-qr-code";

// ═══════════════════════════════════════════════════════════════════════════
// Printable QR Code Page — /rack/[token]/qr
//
// Opens in a new tab. Shows a print-ready QR code card with:
//   - QR code (rendered client-side via react-qr-code, no external API)
//   - Rack label and dimensions
//   - Brief instructions for the customer
//   - Storage Network branding
//
// Designed for thermal label printers or regular paper (cut along border).
// ═══════════════════════════════════════════════════════════════════════════

export default function QrPrintPage() {
  const params = useParams();
  const token = params.token as string;

  const [rack, setRack] = useState<InventoryRack | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRackByToken(token).then((result) => {
      if (result.rack) setRack(result.rack);
      setLoading(false);
    });
  }, [token]);

  const rackUrl = typeof window !== "undefined"
    ? `${window.location.origin}/rack/${token}`
    : "";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!rack) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Rack not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Print button — hidden when printing */}
      <div className="print:hidden p-4 bg-gray-50 border-b flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Print this page and attach the QR code to the rack
        </p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>

      {/* Printable QR Card */}
      <div className="flex justify-center py-8 print:py-0">
        <div className="w-[3.5in] border-2 border-dashed border-gray-300 rounded-2xl p-6 print:border-solid print:border-gray-200">
          {/* Header */}
          <div className="text-center mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
              Storage Network
            </p>
            <h1 className="text-lg font-black text-gray-900 leading-tight">
              {rack.label}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {rack.cols} wide &times; {rack.rows} high
            </p>
          </div>

          {/* QR Code — rendered client-side, no external API */}
          <div className="flex justify-center my-4">
            {rackUrl && (
              <QRCode
                value={rackUrl}
                size={192}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            )}
          </div>

          {/* Instructions */}
          <div className="text-center space-y-1.5">
            <p className="text-xs font-semibold text-gray-700">
              Scan to manage your tote inventory
            </p>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Open your phone camera &bull; Point at QR code &bull; Tap the link
              &bull; Add items to each tote
            </p>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-gray-200 text-center">
            <p className="text-[9px] text-gray-300 font-mono break-all">
              {rackUrl}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
