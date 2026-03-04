"use client";
// ═══════════════════════════════════════════════════════════════════════════
// SCAN WIZARD — Multi-step flow for AI-powered wall measurement
//
// Flow: IDLE → SCAN_BARCODE → INSTRUCT_PLACEMENT → CAPTURE_WALL → ANALYZING → RESULTS
// Uses barcode scanning to identify tote, then AI vision to measure wall
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { X, Camera, Scan, ArrowRight, RotateCcw, Check, AlertCircle, Loader2 } from "lucide-react";
import { getToteByUPC, getAllUniqueTotes, type ScanToteData } from "@/lib/scan-data";
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
  onComplete: (wallWidth: number, wallHeight: number | undefined, toteType: "HDX" | "GM") => void;
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

    // Check for BarcodeDetector support
    if (!("BarcodeDetector" in window)) {
      console.warn("BarcodeDetector not supported");
      return;
    }

    // Initialize detector
    detectorRef.current = new BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
    });

    // Start scanning interval
    scanIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;

      if (!video || !detector || video.readyState !== video.HAVE_ENOUGH_DATA) {
        return;
      }

      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          if (code) {
            onDetect(code);
          }
        }
      } catch (err) {
        // Silently handle detection errors
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

// ── Main Component ──────────────────────────────────────────────────────────
export default function ScanWizard({ isOpen, onClose, onComplete }: ScanWizardProps) {
  // State
  const [step, setStep] = useState<WizardStep>("IDLE");
  const [selectedTote, setSelectedTote] = useState<ScanToteData | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Camera Management ─────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please check permissions.");
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // ── Barcode Detection Handler ─────────────────────────────────────────────
  const handleBarcodeDetected = useCallback((code: string) => {
    const tote = getToteByUPC(code);
    if (tote) {
      setSelectedTote(tote);
      setStep("INSTRUCT_PLACEMENT");
      stopCamera();
    } else {
      setError(`Unknown barcode: ${code}. Try manual selection.`);
    }
  }, [stopCamera]);

  // Use barcode scanner hook
  useBarcodeScanner(videoRef, handleBarcodeDetected, step === "SCAN_BARCODE" && cameraActive);

  // ── Capture Photo ─────────────────────────────────────────────────────────
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
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
    stopCamera();
  }, [stopCamera]);

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
        setError(err instanceof Error ? err.message : "Failed to analyze image");
        setStep("CAPTURE_WALL");
      }
    };

    analyzeImage();
  }, [step, capturedImage, selectedTote]);

  // ── Step Navigation ───────────────────────────────────────────────────────
  const startWizard = useCallback(() => {
    setStep("SCAN_BARCODE");
    setError(null);
    startCamera();
  }, [startCamera]);

  const goToCapture = useCallback(() => {
    setStep("CAPTURE_WALL");
    setError(null);
    startCamera();
  }, [startCamera]);

  const handleManualSelect = useCallback((tote: ScanToteData) => {
    setSelectedTote(tote);
    setStep("INSTRUCT_PLACEMENT");
    stopCamera();
  }, [stopCamera]);

  const handleRetry = useCallback(() => {
    setCapturedImage(null);
    setMeasurement(null);
    setError(null);
    setStep("CAPTURE_WALL");
    startCamera();
  }, [startCamera]);

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
    stopCamera();
    setStep("IDLE");
    setSelectedTote(null);
    setCapturedImage(null);
    setMeasurement(null);
    setError(null);
    onClose();
  }, [stopCamera, onClose]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  const allTotes = getAllUniqueTotes();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="scrollbar-dark relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Scan className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">Scan-to-Build Wizard</h2>
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
          <div className="flex items-center justify-center gap-2 mb-8">
            {["Scan", "Place", "Capture", "Results"].map((label, idx) => {
              const stepMap: WizardStep[] = ["SCAN_BARCODE", "INSTRUCT_PLACEMENT", "CAPTURE_WALL", "RESULTS"];
              const currentIdx = stepMap.indexOf(step);
              const isActive = idx <= currentIdx && step !== "IDLE";
              const isCurrent = idx === currentIdx;

              return (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      isCurrent
                        ? "bg-yellow-400 text-slate-900"
                        : isActive
                        ? "bg-green-500 text-white"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {isActive && idx < currentIdx ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-sm ${isActive ? "text-white" : "text-slate-500"}`}>
                    {label}
                  </span>
                  {idx < 3 && (
                    <div className={`w-8 h-0.5 ${isActive && idx < currentIdx ? "bg-green-500" : "bg-slate-700"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Error</p>
                <p className="text-red-300 text-sm">{error}</p>
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
                Scan your storage tote barcode, place it against your wall, and let AI
                calculate the perfect fit for your space.
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
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Scan Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-32 border-2 border-yellow-400 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-yellow-400" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-yellow-400" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-yellow-400" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-yellow-400" />
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-yellow-400/50 animate-pulse" />
                  </div>
                </div>
                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
                  </div>
                )}
              </div>

              {/* Manual Selection */}
              <div className="border-t border-slate-800 pt-6">
                <p className="text-slate-400 text-sm mb-4 text-center">
                  Or select your tote manually:
                </p>
                <div className="grid gap-3">
                  {allTotes.map((tote) => (
                    <button
                      key={tote.id}
                      onClick={() => handleManualSelect(tote)}
                      className="flex items-center justify-between p-4 bg-slate-900 border border-slate-700 rounded-lg hover:border-yellow-400/50 hover:bg-slate-800 transition-colors text-left"
                    >
                      <div>
                        <p className="text-white font-medium">{tote.brand} {tote.name}</p>
                        <p className="text-slate-400 text-sm">
                          {tote.retailer} • {tote.width}" × {tote.depth}" × {tote.height}"
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
                <p className="text-yellow-400 font-medium">{selectedTote.brand} {selectedTote.name}</p>
                <p className="text-slate-400 text-sm">
                  Reference width: {selectedTote.width}" • {selectedTote.retailer}
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-8 text-left">
                <h4 className="text-white font-semibold mb-4">Step 2: Place Your Tote</h4>
                <ol className="space-y-3 text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-yellow-400/10 rounded-full flex items-center justify-center text-yellow-400 text-sm font-medium">1</span>
                    <span>Place the tote flat against the wall where you want to install storage</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-yellow-400/10 rounded-full flex items-center justify-center text-yellow-400 text-sm font-medium">2</span>
                    <span>Position it near the center of the wall section</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-yellow-400/10 rounded-full flex items-center justify-center text-yellow-400 text-sm font-medium">3</span>
                    <span>Make sure the full wall width is visible</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-yellow-400/10 rounded-full flex items-center justify-center text-yellow-400 text-sm font-medium">4</span>
                    <span>Stand back and center the camera for best results</span>
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
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={capturePhoto}
                  disabled={!cameraActive}
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
                      {measurement.widthInches.toFixed(1)}"
                    </p>
                    <p className="text-slate-500 text-sm">
                      ({(measurement.widthInches / 12).toFixed(1)} ft)
                    </p>
                  </div>
                  {measurement.heightInches && (
                    <div className="text-center">
                      <p className="text-slate-400 text-sm mb-1">Wall Height</p>
                      <p className="text-3xl font-bold text-yellow-400">
                        {measurement.heightInches.toFixed(1)}"
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
