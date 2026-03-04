"use client";
// ═══════════════════════════════════════════════════════════════════════════
// SCAN WIZARD — Multi-step flow for AI-powered wall measurement
//
// Flow: IDLE → SCAN_BARCODE → INSTRUCT_PLACEMENT → CAPTURE_WALL → ANALYZING → RESULTS
// Uses barcode scanning to identify tote, then AI vision to measure wall.
//
// Camera access is managed by the shared useCameraStream hook, which handles
// getUserMedia, permission tracking, error classification, and cleanup.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from "react";
import "barcode-detector/side-effects";
import Image from "next/image";
import {
  X,
  Camera,
  Scan,
  ArrowRight,
  RotateCcw,
  Check,
  AlertCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { getToteByUPC, getAllUniqueTotes, type ScanToteData } from "@/lib/scan-data";
import { useCameraStream } from "@/hooks/useCameraStream";
import type { MeasurementResult } from "@/app/api/vision/measure/route";

// ── Types ───────────────────────────────────────────────────────────────────
type WizardStep =
  | "IDLE"
  | "SCAN_BARCODE"
  | "INSTRUCT_PLACEMENT"
  | "CAPTURE_WALL"
  | "ANALYZING"
  | "RESULTS";

interface ScanWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (
    wallWidth: number,
    wallHeight: number | undefined,
    toteType: "HDX" | "GM"
  ) => void;
}

// ── Barcode Scanner Hook ────────────────────────────────────────────────────
function useBarcodeScanner(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onDetect: (code: string) => void,
  isScanning: boolean
) {
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isScanning) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      return;
    }

    if (!("BarcodeDetector" in window)) {
      console.warn("BarcodeDetector not supported");
      return;
    }

    detectorRef.current = new BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
    });

    scanIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          onDetect(barcodes[0].rawValue);
        }
      } catch {
        // Detection error — retry on next interval
      }
    }, 200);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [isScanning, onDetect, videoRef]);
}

// ── Camera Blocked UI (shared between scan & capture steps) ─────────────────
function CameraBlockedOverlay({
  errorMessage,
  permissionState,
  retryCount,
  onRetry,
  context,
}: {
  errorMessage: string | null;
  permissionState: string;
  retryCount: number;
  onRetry: () => void;
  context: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
      <div className="flex flex-col items-center px-6">
        <ShieldAlert className="w-10 h-10 text-yellow-400 mb-3" />
        <p className="text-slate-300 text-sm text-center mb-2">
          Camera access is needed to {context}
        </p>
        {errorMessage && (
          <p className="text-slate-400 text-xs text-center mb-4 max-w-xs">
            {errorMessage}
          </p>
        )}
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 text-slate-900 font-semibold rounded-lg hover:bg-yellow-300 transition-colors text-sm"
        >
          <Camera className="w-4 h-4" />
          {permissionState === "denied" ? "Try Again" : "Allow Camera Access"}
        </button>
        {permissionState === "denied" && (
          <p className="text-slate-500 text-xs text-center mt-3 max-w-xs">
            Permission was blocked. Tap the lock/camera icon in your
            browser&apos;s address bar to allow access.
          </p>
        )}
        {retryCount >= 1 && (
          <>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Page
            </button>
            <p className="text-yellow-400 text-xs text-center mt-2 font-medium">
              Most mobile browsers require a page reload after changing camera
              permissions.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function ScanWizard({
  isOpen,
  onClose,
  onComplete,
}: ScanWizardProps) {
  // State
  const [step, setStep] = useState<WizardStep>("IDLE");
  const [selectedTote, setSelectedTote] = useState<ScanToteData | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [barcodeSupported, setBarcodeSupported] = useState(true);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Camera (shared hook)
  const camera = useCameraStream();

  // Check BarcodeDetector support on mount
  useEffect(() => {
    if (typeof window !== "undefined" && !("BarcodeDetector" in window)) {
      setBarcodeSupported(false);
    }
  }, []);

  // ── Barcode Detection Handler ─────────────────────────────────────────────
  const handleBarcodeDetected = useCallback(
    (code: string) => {
      const tote = getToteByUPC(code);
      if (tote) {
        setSelectedTote(tote);
        setStep("INSTRUCT_PLACEMENT");
        camera.stop();
      } else {
        setWizardError(`Unknown barcode: ${code}. Try manual selection.`);
      }
    },
    [camera]
  );

  // Use barcode scanner hook
  useBarcodeScanner(
    camera.videoRef,
    handleBarcodeDetected,
    step === "SCAN_BARCODE" && camera.isActive
  );

  // ── Capture Photo ─────────────────────────────────────────────────────────
  const capturePhoto = useCallback(() => {
    const video = camera.videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageData);
    setStep("ANALYZING");
    camera.stop();
  }, [camera]);

  // ── Analyze Image with AI ─────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "ANALYZING" || !capturedImage || !selectedTote) return;

    const analyzeImage = async () => {
      try {
        const response = await fetch("/api/vision/measure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: capturedImage,
            referenceWidth: selectedTote.width,
            referenceDepth: selectedTote.depth,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to analyze image");
        }

        const data = await response.json();
        setMeasurement(data.measurement);
        setStep("RESULTS");
      } catch (err) {
        console.error("Analysis error:", err);
        setWizardError(
          err instanceof Error ? err.message : "Failed to analyze image"
        );
        setStep("CAPTURE_WALL");
      }
    };

    analyzeImage();
  }, [step, capturedImage, selectedTote]);

  // ── Step Navigation ───────────────────────────────────────────────────────
  const startWizard = useCallback(() => {
    setStep("SCAN_BARCODE");
    setWizardError(null);
    camera.start();
  }, [camera]);

  const goToCapture = useCallback(() => {
    setStep("CAPTURE_WALL");
    setWizardError(null);
    camera.start();
  }, [camera]);

  const handleManualSelect = useCallback(
    (tote: ScanToteData) => {
      setSelectedTote(tote);
      setStep("INSTRUCT_PLACEMENT");
      camera.stop();
    },
    [camera]
  );

  const handleRetry = useCallback(() => {
    setCapturedImage(null);
    setMeasurement(null);
    setWizardError(null);
    setStep("CAPTURE_WALL");
    camera.start();
  }, [camera]);

  const handleComplete = useCallback(() => {
    if (measurement && selectedTote) {
      onComplete(
        measurement.widthInches,
        measurement.heightInches,
        selectedTote.configKey
      );
    }
    handleClose();
  }, [measurement, selectedTote, onComplete]);

  const handleClose = useCallback(() => {
    camera.stop();
    setStep("IDLE");
    setSelectedTote(null);
    setCapturedImage(null);
    setMeasurement(null);
    setWizardError(null);
    onClose();
  }, [camera, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      camera.stop();
    };
  }, [camera]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  // Combine camera errors and wizard errors for display
  const displayError = wizardError || (camera.error ? camera.errorMessage : null);
  const allTotes = getAllUniqueTotes();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="scrollbar-dark relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Scan className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">
              Scan-to-Build Wizard
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step Progress */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8 px-2">
            {["Scan", "Place", "Capture", "Results"].map((label, idx) => {
              const stepMap: WizardStep[] = [
                "SCAN_BARCODE",
                "INSTRUCT_PLACEMENT",
                "CAPTURE_WALL",
                "RESULTS",
              ];
              const currentIdx = stepMap.indexOf(step);
              const isActive = idx <= currentIdx && step !== "IDLE";
              const isCurrent = idx === currentIdx;

              return (
                <div
                  key={label}
                  className="flex items-center gap-1 sm:gap-2 min-w-0"
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${
                      isCurrent
                        ? "bg-yellow-400 text-slate-900"
                        : isActive
                          ? "bg-green-500 text-white"
                          : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {isActive && idx < currentIdx ? (
                      <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={`text-xs sm:text-sm truncate ${isActive ? "text-white" : "text-slate-500"}`}
                  >
                    {label}
                  </span>
                  {idx < 3 && (
                    <div
                      className={`w-4 sm:w-8 h-0.5 flex-shrink-0 ${isActive && idx < currentIdx ? "bg-green-500" : "bg-slate-700"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Error Display */}
          {displayError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Error</p>
                <p className="text-red-300 text-sm">{displayError}</p>
              </div>
            </div>
          )}

          {/* Step: IDLE */}
          {step === "IDLE" && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 bg-yellow-400/10 rounded-full flex items-center justify-center">
                <Scan className="w-10 h-10 text-yellow-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Measure Your Wall with AI
              </h3>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">
                Scan your storage tote barcode, place it against your wall, and
                let AI calculate the perfect fit for your space.
              </p>
              <button
                onClick={startWizard}
                className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 text-slate-900 font-semibold rounded-lg hover:bg-yellow-300 transition-colors"
              >
                Start Scanning
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step: SCAN_BARCODE */}
          {step === "SCAN_BARCODE" && (
            <div>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">
                  Step 1: Scan Your Tote Barcode
                </h3>
                <p className="text-slate-400">
                  Point your camera at the UPC barcode on your storage tote
                </p>
              </div>

              {/* Camera View */}
              <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden mb-6">
                <video
                  ref={camera.videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Scan Overlay */}
                {camera.isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-32 border-2 border-yellow-400 rounded-lg relative">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-yellow-400" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-yellow-400" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-yellow-400" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-yellow-400" />
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-yellow-400/50 animate-pulse" />
                    </div>
                  </div>
                )}
                {/* Camera not active: blocked or loading */}
                {!camera.isActive && (
                  camera.error ? (
                    <CameraBlockedOverlay
                      errorMessage={camera.errorMessage}
                      permissionState={camera.permissionState}
                      retryCount={camera.retryCount}
                      onRetry={() => {
                        setWizardError(null);
                        camera.start();
                      }}
                      context="scan barcodes"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                      <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
                    </div>
                  )
                )}
                {/* BarcodeDetector not supported */}
                {camera.isActive && !barcodeSupported && (
                  <div className="absolute bottom-0 left-0 right-0 bg-yellow-400/90 px-4 py-2 text-center">
                    <p className="text-slate-900 text-xs font-medium">
                      Barcode scanning is not supported in this browser. Please
                      select your tote manually below.
                    </p>
                  </div>
                )}
              </div>

              {/* Manual Selection */}
              <div className="border-t border-slate-800 pt-6">
                <p
                  className={`text-sm mb-4 text-center ${
                    camera.error || (camera.isActive && !barcodeSupported)
                      ? "text-yellow-400 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {camera.error || (camera.isActive && !barcodeSupported)
                    ? "Select your tote manually:"
                    : "Or select your tote manually:"}
                </p>
                <div className="grid gap-3">
                  {allTotes.map((tote) => (
                    <button
                      key={tote.id}
                      onClick={() => handleManualSelect(tote)}
                      className="flex items-center justify-between p-4 bg-slate-900 border border-slate-700 rounded-lg hover:border-yellow-400/50 hover:bg-slate-800 transition-colors text-left"
                    >
                      <div>
                        <p className="text-white font-medium">
                          {tote.brand} {tote.name}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {tote.retailer} &bull; {tote.width}&quot; &times;{" "}
                          {tote.depth}&quot; &times; {tote.height}&quot;
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-slate-500" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step: INSTRUCT_PLACEMENT */}
          {step === "INSTRUCT_PLACEMENT" && selectedTote && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-green-500/10 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Tote Identified!
              </h3>
              <div className="inline-block px-4 py-2 bg-slate-800 rounded-lg mb-6">
                <p className="text-yellow-400 font-medium">
                  {selectedTote.brand} {selectedTote.name}
                </p>
                <p className="text-slate-400 text-sm">
                  Reference width: {selectedTote.width}&quot; &bull;{" "}
                  {selectedTote.retailer}
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-8 text-left">
                <h4 className="text-white font-semibold mb-4">
                  Step 2: Place Your Tote
                </h4>
                <ol className="space-y-3 text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-yellow-400/10 rounded-full flex items-center justify-center text-yellow-400 text-sm font-medium">
                      1
                    </span>
                    <span>
                      Place the tote flat against the wall where you want to
                      install storage
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-yellow-400/10 rounded-full flex items-center justify-center text-yellow-400 text-sm font-medium">
                      2
                    </span>
                    <span>
                      Position it near the center of the wall section
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-yellow-400/10 rounded-full flex items-center justify-center text-yellow-400 text-sm font-medium">
                      3
                    </span>
                    <span>Make sure the full wall width is visible</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-yellow-400/10 rounded-full flex items-center justify-center text-yellow-400 text-sm font-medium">
                      4
                    </span>
                    <span>
                      Stand back and center the camera for best results
                    </span>
                  </li>
                </ol>
              </div>

              <button
                onClick={goToCapture}
                className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 text-slate-900 font-semibold rounded-lg hover:bg-yellow-300 transition-colors"
              >
                <Camera className="w-5 h-5" />
                Ready to Capture
              </button>
            </div>
          )}

          {/* Step: CAPTURE_WALL */}
          {step === "CAPTURE_WALL" && (
            <div>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">
                  Step 3: Capture Your Wall
                </h3>
                <p className="text-slate-400">
                  Make sure the tote and entire wall width are visible
                </p>
              </div>

              {/* Camera View */}
              <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden mb-6">
                <video
                  ref={camera.videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!camera.isActive && (
                  camera.error ? (
                    <CameraBlockedOverlay
                      errorMessage={camera.errorMessage}
                      permissionState={camera.permissionState}
                      retryCount={camera.retryCount}
                      onRetry={() => {
                        setWizardError(null);
                        camera.start();
                      }}
                      context="capture your wall"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                      <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
                    </div>
                  )
                )}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={capturePhoto}
                  disabled={!camera.isActive}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-yellow-400 text-slate-900 font-semibold rounded-full hover:bg-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-6 h-6" />
                  Capture Photo
                </button>
              </div>

              {/* Hidden canvas for capture */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Step: ANALYZING */}
          {step === "ANALYZING" && (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 bg-yellow-400/10 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Analyzing Your Wall
              </h3>
              <p className="text-slate-400">
                AI is measuring your wall using the tote as reference...
              </p>
            </div>
          )}

          {/* Step: RESULTS */}
          {step === "RESULTS" && measurement && selectedTote && (
            <div>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Measurement Complete!
                </h3>
              </div>

              {/* Captured Image Preview */}
              {capturedImage && (
                <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden mb-6">
                  <Image
                    src={capturedImage}
                    alt="Captured wall"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}

              {/* Measurement Results */}
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <div className="text-center">
                    <p className="text-slate-400 text-sm mb-1">Wall Width</p>
                    <p className="text-3xl font-bold text-yellow-400">
                      {measurement.widthInches.toFixed(1)}&quot;
                    </p>
                    <p className="text-slate-500 text-sm">
                      ({(measurement.widthInches / 12).toFixed(1)} ft)
                    </p>
                  </div>
                  {measurement.heightInches && (
                    <div className="text-center">
                      <p className="text-slate-400 text-sm mb-1">Wall Height</p>
                      <p className="text-3xl font-bold text-yellow-400">
                        {measurement.heightInches.toFixed(1)}&quot;
                      </p>
                      <p className="text-slate-500 text-sm">
                        ({(measurement.heightInches / 12).toFixed(1)} ft)
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 mb-4">
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      measurement.confidence === "high"
                        ? "bg-green-500/10 text-green-400"
                        : measurement.confidence === "medium"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {measurement.confidence} confidence
                  </div>
                </div>

                <p className="text-slate-400 text-sm text-center">
                  {measurement.reasoning}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={handleRetry}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                  Retake Photo
                </button>
                <button
                  onClick={handleComplete}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-yellow-400 text-slate-900 font-semibold rounded-lg hover:bg-yellow-300 transition-colors"
                >
                  <Check className="w-5 h-5" />
                  Use These Measurements
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
