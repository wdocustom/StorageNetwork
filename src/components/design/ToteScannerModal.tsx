"use client";

// ═══════════════════════════════════════════════════════════════════════════
// TOTE SCANNER MODAL — Barcode scanner with manual fallback
//
// Camera access is managed by the shared useCameraStream hook.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import "barcode-detector/side-effects";
import {
  X,
  Camera,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  Package,
  ChevronRight,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import {
  type ToteDefinition,
  getToteByUPC,
  getAllTotes,
  formatToteDimensions,
} from "@/lib/tote-data";
import { useCameraStream } from "@/hooks/useCameraStream";

type ScannerState = "idle" | "scanning" | "matched" | "error" | "manual";

interface ToteScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToteSelected: (tote: ToteDefinition) => void;
}

// ── Retailer brand colors ─────────────────────────────────────────────────
const RETAILER_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  "Home Depot": {
    bg: "bg-orange-500/20",
    text: "text-orange-400",
    border: "border-orange-500/30",
  },
  Costco: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    border: "border-red-500/30",
  },
  "Lowe's": {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
};

export default function ToteScannerModal({
  isOpen,
  onClose,
  onToteSelected,
}: ToteScannerModalProps) {
  const [state, setState] = useState<ScannerState>("idle");
  const [matchedTote, setMatchedTote] = useState<ToteDefinition | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barcodeDetectorRef = useRef<BarcodeDetector | null>(null);

  // Camera (shared hook)
  const camera = useCameraStream({ idealWidth: 1280, idealHeight: 720 });

  // ── Initialize barcode detector ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      barcodeDetectorRef.current = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
      });
    }
  }, []);

  // ── Handle detected barcode ───────────────────────────────────────────
  const handleBarcodeDetected = useCallback(
    (code: string) => {
      if (state === "matched") return;

      const tote = getToteByUPC(code);

      if (tote) {
        setMatchedTote(tote);
        setState("matched");
        camera.stop();
        stopScanning();

        setTimeout(() => {
          onToteSelected(tote);
          onClose();
        }, 1500);
      } else {
        setErrorMessage(`Unknown barcode: ${code}`);
        setState("error");

        setTimeout(() => {
          setState((prev) => (prev === "error" ? "scanning" : prev));
          setErrorMessage("");
        }, 2000);
      }
    },
    [state, onToteSelected, onClose, camera]
  );

  // ── Barcode scanning loop ─────────────────────────────────────────────
  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  const startScanning = useCallback(() => {
    if (scanIntervalRef.current) return;

    scanIntervalRef.current = setInterval(async () => {
      if (
        !camera.videoRef.current ||
        !canvasRef.current ||
        isProcessing
      )
        return;
      if (
        camera.videoRef.current.readyState !==
        camera.videoRef.current.HAVE_ENOUGH_DATA
      )
        return;

      const video = camera.videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (barcodeDetectorRef.current) {
        try {
          setIsProcessing(true);
          const barcodes = await barcodeDetectorRef.current.detect(canvas);
          if (barcodes.length > 0) {
            handleBarcodeDetected(barcodes[0].rawValue);
          }
        } catch {
          // Silently fail and retry
        } finally {
          setIsProcessing(false);
        }
      }
    }, 250);
  }, [isProcessing, camera.videoRef, handleBarcodeDetected]);

  // ── Start camera and scanning ─────────────────────────────────────────
  const startCameraAndScan = useCallback(async () => {
    await camera.start();
    // Camera hook sets isActive on success — we start scanning in an effect
  }, [camera]);

  // When camera becomes active, begin scanning
  useEffect(() => {
    if (camera.isActive && state !== "matched") {
      setState("scanning");
      startScanning();
    }
  }, [camera.isActive, state, startScanning]);

  // When camera errors out, go to manual
  useEffect(() => {
    if (camera.error) {
      stopScanning();
      // For "not-found" or "unsupported" errors, go straight to manual
      if (camera.error === "not-found" || camera.error === "unsupported") {
        setState("manual");
      }
      // For "denied" or "in-use", show inline error with retry
    }
  }, [camera.error, stopScanning]);

  // ── Manual tote selection ─────────────────────────────────────────────
  const handleManualSelect = (tote: ToteDefinition) => {
    setMatchedTote(tote);
    setState("matched");
    camera.stop();
    stopScanning();

    setTimeout(() => {
      onToteSelected(tote);
      onClose();
    }, 800);
  };

  const switchToManual = () => {
    camera.stop();
    stopScanning();
    setState("manual");
  };

  const switchToScanner = () => {
    setState("idle");
    startCameraAndScan();
  };

  // ── Lifecycle: Start/stop camera on modal open/close ──────────────────
  useEffect(() => {
    if (isOpen && state === "idle") {
      startCameraAndScan();
    }
    return () => {
      camera.stop();
      stopScanning();
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setState("idle");
      setMatchedTote(null);
      setErrorMessage("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showCameraView =
    (state === "idle" ||
      state === "scanning" ||
      state === "error" ||
      state === "matched") &&
    !camera.error;

  const showCameraError =
    (state === "idle" || state === "scanning") &&
    camera.error &&
    camera.error !== "not-found" &&
    camera.error !== "unsupported";

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
              <h2 className="text-lg font-bold text-white">
                Identify Your Tote
              </h2>
              <p className="text-xs text-stone-400">
                Scan the barcode or select manually
              </p>
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
          {showCameraView && (
            <div className="space-y-4">
              {/* Camera Container */}
              <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-700 bg-black">
                <video
                  ref={camera.videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Scanning Overlay */}
                {state === "scanning" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative h-48 w-64">
                      <div className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-yellow-400" />
                      <div className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-yellow-400" />
                      <div className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-yellow-400" />
                      <div className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-yellow-400" />
                      <div className="absolute left-2 right-2 h-0.5 animate-scan bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
                    </div>
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
                    <p className="text-sm font-semibold text-red-400">
                      Unknown Barcode
                    </p>
                    <p className="mt-1 text-xs text-red-300/80">
                      Try Manual Select below
                    </p>
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
                {state === "idle" && !camera.error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80">
                    <Camera className="mb-2 h-8 w-8 animate-pulse text-stone-400" />
                    <p className="text-sm text-stone-400">Starting camera...</p>
                  </div>
                )}
              </div>

              {/* Fallback Section */}
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-stone-300">
                    Label missing or damaged?
                  </p>
                  <p className="text-xs text-stone-500">
                    Select your tote manually
                  </p>
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

          {/* Camera Error View (denied / in-use) */}
          {showCameraError && (
            <div className="space-y-4">
              <div className="flex flex-col items-center rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-8">
                <ShieldAlert className="w-10 h-10 text-yellow-400 mb-3" />
                <p className="text-slate-300 text-sm text-center mb-2">
                  Camera access is needed to scan barcodes
                </p>
                {camera.errorMessage && (
                  <p className="text-slate-400 text-xs text-center mb-4 max-w-xs">
                    {camera.errorMessage}
                  </p>
                )}
                <button
                  onClick={() => camera.start()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 text-slate-900 font-semibold rounded-lg hover:bg-yellow-300 transition-colors text-sm"
                >
                  <Camera className="w-4 h-4" />
                  {camera.permissionState === "denied"
                    ? "Try Again"
                    : "Allow Camera Access"}
                </button>
                {camera.retryCount >= 1 && (
                  <>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors text-sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reload Page
                    </button>
                    <p className="text-yellow-400 text-xs text-center mt-2 font-medium">
                      Most mobile browsers require a page reload after changing
                      camera permissions.
                    </p>
                  </>
                )}
                <button
                  onClick={switchToManual}
                  className="mt-4 text-sm text-stone-400 hover:text-yellow-400 transition-colors"
                >
                  Or select your tote manually
                </button>
              </div>
            </div>
          )}

          {/* Manual Selection View */}
          {(state === "manual" ||
            camera.error === "not-found" ||
            camera.error === "unsupported") && (
            <div className="space-y-4">
              {/* Back to scanner (only if camera might work) */}
              {camera.error !== "not-found" &&
                camera.error !== "unsupported" && (
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
                <p className="text-sm font-semibold text-stone-300">
                  Select your tote:
                </p>

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
                        <div
                          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${colors.bg} ${colors.border} border`}
                        >
                          <Package className={`h-7 w-7 ${colors.text}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white group-hover:text-yellow-400">
                              {tote.brand}
                            </h3>
                            <span
                              className={`rounded-full ${colors.bg} px-2 py-0.5 text-[10px] font-semibold ${colors.text}`}
                            >
                              {tote.retailer}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-stone-400">
                            {tote.capacity}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            {formatToteDimensions(tote)}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-stone-600 transition-transform group-hover:translate-x-1 group-hover:text-yellow-400" />
                      </div>
                    </button>
                  );
                })}
              </div>

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
          0%,
          100% {
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
          0%,
          100% {
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

// BarcodeDetector types are provided by the "barcode-detector" polyfill package.
