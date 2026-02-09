"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Camera, ScanLine, CheckCircle2, AlertCircle, Package, ChevronRight } from "lucide-react";
import { type ToteDefinition, getToteByUPC, getAllTotes, formatToteDimensions } from "@/lib/tote-data";

// ═══════════════════════════════════════════════════════════════════════════
// TOTE SCANNER MODAL — Barcode scanner with manual fallback
// ═══════════════════════════════════════════════════════════════════════════

type ScannerState = "idle" | "scanning" | "matched" | "error" | "manual";

interface ToteScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToteSelected: (tote: ToteDefinition) => void;
}

// ── Retailer brand colors ─────────────────────────────────────────────────
const RETAILER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Home Depot": { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" },
  "Costco": { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
  "Lowe's": { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
};

export default function ToteScannerModal({
  isOpen,
  onClose,
  onToteSelected,
}: ToteScannerModalProps) {
  const [state, setState] = useState<ScannerState>("idle");
  const [matchedTote, setMatchedTote] = useState<ToteDefinition | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── BarcodeDetector API (native browser API) ────────────────────────────
  const barcodeDetectorRef = useRef<BarcodeDetector | null>(null);

  // ── Initialize barcode detector ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      barcodeDetectorRef.current = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
      });
    }
  }, []);

  // ── Start camera stream ─────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setState("scanning");
        startScanning();
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setHasCamera(false);
      setState("manual");
    }
  }, []);

  // ── Stop camera stream ──────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // ── Barcode scanning loop ───────────────────────────────────────────────
  const startScanning = useCallback(() => {
    if (scanIntervalRef.current) return;

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || isProcessing) return;
      if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Try native BarcodeDetector first
      if (barcodeDetectorRef.current) {
        try {
          setIsProcessing(true);
          const barcodes = await barcodeDetectorRef.current.detect(canvas);

          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            handleBarcodeDetected(code);
          }
        } catch {
          // Silently fail and retry
        } finally {
          setIsProcessing(false);
        }
      }
    }, 250); // Scan every 250ms
  }, [isProcessing]);

  // ── Handle detected barcode ─────────────────────────────────────────────
  const handleBarcodeDetected = useCallback(
    (code: string) => {
      if (state === "matched") return; // Already matched

      const tote = getToteByUPC(code);

      if (tote) {
        // Success! Found a matching tote
        setMatchedTote(tote);
        setState("matched");
        stopCamera();

        // Auto-close after 1.5s
        setTimeout(() => {
          onToteSelected(tote);
          onClose();
        }, 1500);
      } else {
        // Unknown barcode
        setErrorMessage(`Unknown barcode: ${code}`);
        setState("error");

        // Reset error after 2 seconds
        setTimeout(() => {
          if (state === "error") {
            setState("scanning");
            setErrorMessage("");
          }
        }, 2000);
      }
    },
    [state, onToteSelected, onClose, stopCamera]
  );

  // ── Manual tote selection ───────────────────────────────────────────────
  const handleManualSelect = (tote: ToteDefinition) => {
    setMatchedTote(tote);
    setState("matched");
    stopCamera();

    setTimeout(() => {
      onToteSelected(tote);
      onClose();
    }, 800);
  };

  // ── Switch to manual mode ───────────────────────────────────────────────
  const switchToManual = () => {
    stopCamera();
    setState("manual");
  };

  // ── Switch to scanner mode ──────────────────────────────────────────────
  const switchToScanner = () => {
    setState("idle");
    startCamera();
  };

  // ── Lifecycle: Start/stop camera on modal open/close ────────────────────
  useEffect(() => {
    if (isOpen && state === "idle") {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera, state]);

  // ── Reset state when modal closes ───────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setState("idle");
      setMatchedTote(null);
      setErrorMessage("");
    }
  }, [isOpen]);

  // ── Don't render if not open ────────────────────────────────────────────
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/20">
              <ScanLine className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Identify Your Tote</h2>
              <p className="text-xs text-stone-400">Scan the barcode or select manually</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Scanner View */}
          {(state === "idle" || state === "scanning" || state === "error" || state === "matched") && hasCamera && (
            <div className="space-y-4">
              {/* Camera Container */}
              <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-700 bg-black">
                {/* Video Element */}
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                />

                {/* Hidden canvas for processing */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Scanning Overlay */}
                {state === "scanning" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Corner brackets */}
                    <div className="relative h-48 w-64">
                      {/* Top-left */}
                      <div className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-yellow-400" />
                      {/* Top-right */}
                      <div className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-yellow-400" />
                      {/* Bottom-left */}
                      <div className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-yellow-400" />
                      {/* Bottom-right */}
                      <div className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-yellow-400" />

                      {/* Animated laser line */}
                      <div className="absolute left-2 right-2 h-0.5 animate-scan bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
                    </div>

                    {/* Status text */}
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <p className="text-sm font-medium text-yellow-400">
                        Point camera at barcode
                      </p>
                    </div>
                  </div>
                )}

                {/* Error Overlay */}
                {state === "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-sm">
                    <AlertCircle className="mb-2 h-12 w-12 text-red-400" />
                    <p className="text-sm font-semibold text-red-400">Unknown Barcode</p>
                    <p className="mt-1 text-xs text-red-300/80">Try Manual Select below</p>
                  </div>
                )}

                {/* Success Overlay */}
                {state === "matched" && matchedTote && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/90 backdrop-blur-sm">
                    <div className="animate-bounce-once">
                      <CheckCircle2 className="mb-3 h-16 w-16 text-emerald-400" />
                    </div>
                    <p className="text-lg font-bold text-emerald-400">Found!</p>
                    <p className="mt-1 text-sm text-emerald-300">
                      {matchedTote.brand} {matchedTote.capacity}
                    </p>
                  </div>
                )}

                {/* Loading state */}
                {state === "idle" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80">
                    <Camera className="mb-2 h-8 w-8 animate-pulse text-stone-400" />
                    <p className="text-sm text-stone-400">Starting camera...</p>
                  </div>
                )}
              </div>

              {/* Fallback Section */}
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-stone-300">Label missing or damaged?</p>
                  <p className="text-xs text-stone-500">Select your tote manually</p>
                </div>
                <button
                  onClick={switchToManual}
                  className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-600"
                >
                  Select Manually
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Manual Selection View */}
          {(state === "manual" || !hasCamera) && (
            <div className="space-y-4">
              {/* Back to scanner button (if camera available) */}
              {hasCamera && (
                <button
                  onClick={switchToScanner}
                  className="flex items-center gap-2 text-sm text-stone-400 transition-colors hover:text-yellow-400"
                >
                  <Camera className="h-4 w-4" />
                  Back to Scanner
                </button>
              )}

              {/* Tote Selection Grid */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-stone-300">Select your tote:</p>

                {getAllTotes().map((tote) => {
                  const colors = RETAILER_COLORS[tote.retailer] || {
                    bg: "bg-slate-500/20",
                    text: "text-slate-400",
                    border: "border-slate-500/30",
                  };

                  return (
                    <button
                      key={tote.id}
                      onClick={() => handleManualSelect(tote)}
                      className="group w-full rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-left transition-all hover:border-yellow-400/50 hover:bg-slate-800"
                    >
                      <div className="flex items-start gap-4">
                        {/* Tote Icon */}
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${colors.bg} ${colors.border} border`}>
                          <Package className={`h-7 w-7 ${colors.text}`} />
                        </div>

                        {/* Tote Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white group-hover:text-yellow-400">
                              {tote.brand}
                            </h3>
                            <span className={`rounded-full ${colors.bg} px-2 py-0.5 text-[10px] font-semibold ${colors.text}`}>
                              {tote.retailer}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-stone-400">{tote.capacity}</p>
                          <p className="mt-1 text-xs text-stone-500">
                            {formatToteDimensions(tote)}
                          </p>
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="h-5 w-5 shrink-0 text-stone-600 transition-transform group-hover:translate-x-1 group-hover:text-yellow-400" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Help text */}
              <p className="text-center text-xs text-stone-500">
                Don&apos;t see your tote? Contact support for assistance.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-900/50 px-5 py-3">
          <p className="text-center text-xs text-stone-500">
            Scan the UPC barcode on the side of your storage tote
          </p>
        </div>
      </div>

      {/* Custom Animation Styles */}
      <style jsx global>{`
        @keyframes scan {
          0%, 100% {
            top: 0.5rem;
          }
          50% {
            top: calc(100% - 0.5rem);
          }
        }

        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }

        @keyframes bounce-once {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }

        .animate-bounce-once {
          animation: bounce-once 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}

// ── TypeScript declaration for BarcodeDetector ────────────────────────────
declare global {
  interface Window {
    BarcodeDetector: typeof BarcodeDetector;
  }

  class BarcodeDetector {
    constructor(options?: { formats: string[] });
    detect(image: ImageBitmapSource): Promise<{ rawValue: string; format: string }[]>;
    static getSupportedFormats(): Promise<string[]>;
  }
}
