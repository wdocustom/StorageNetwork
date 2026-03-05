"use client";

// ═══════════════════════════════════════════════════════════════════════════
// WallTapMeasure — "Point & Tap" wall measurement
//
// Two modes:
//   1. WebXR (AR) — If the device supports immersive-ar with hit-test,
//      taps resolve to real-world 3D points and distance is exact.
//   2. Camera Fallback — Live camera feed where the user taps two wall
//      corners. A known-size reference (the tote) is used to convert
//      pixel distance to inches via ratio math.
//
// Props.referenceWidthInches is the tote's visible face width.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Crosshair,
  RotateCcw,
  Check,
  Loader2,
  Move,
  ShieldAlert,
  Camera,
} from "lucide-react";
import { useCameraStream, type UseCameraStreamReturn } from "@/hooks/useCameraStream";
import { useWebXRMeasure } from "@/hooks/useWebXRMeasure";

// ── Types ────────────────────────────────────────────────────────────────

interface TapPoint {
  /** Pixel coordinates on the video/canvas */
  px: number;
  py: number;
  /** Label */
  label: string;
}

interface WallTapMeasureProps {
  /** Known reference width in inches (tote visible face) */
  referenceWidthInches: number;
  /** Known reference height in inches (tote height ~14.75") */
  referenceHeightInches?: number;
  /** Called when measurement is complete */
  onMeasured: (widthInches: number, heightInches: number | undefined) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Shared camera instance from parent (avoids duplicate stream on mobile) */
  camera?: UseCameraStreamReturn;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Compute distance in inches between two pixel points using a reference object.
 *  The reference tote should also be tapped to calibrate. */
function pixelToInches(
  p1: TapPoint,
  p2: TapPoint,
  refPixelWidth: number,
  refRealWidth: number
): number {
  const pixelDist = Math.sqrt(
    (p2.px - p1.px) ** 2 + (p2.py - p1.py) ** 2
  );
  const inchesPerPixel = refRealWidth / refPixelWidth;
  return pixelDist * inchesPerPixel;
}

// ── Component ────────────────────────────────────────────────────────────

type MeasurePhase =
  | "calibrate_left"   // Tap left edge of tote
  | "calibrate_right"  // Tap right edge of tote
  | "corner_1"         // Tap bottom-left wall corner
  | "corner_2"         // Tap top-right wall corner
  | "done";

export default function WallTapMeasure({
  referenceWidthInches,
  referenceHeightInches = 14.75,
  onMeasured,
  onCancel,
  camera: externalCamera,
}: WallTapMeasureProps) {
  const webxr = useWebXRMeasure();
  const internalCamera = useCameraStream();
  const camera = externalCamera ?? internalCamera;
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use camera-based fallback (WebXR is rarely available on mobile web)
  const useXR = webxr.supported === true;

  const [phase, setPhase] = useState<MeasurePhase>("calibrate_left");
  const [taps, setTaps] = useState<TapPoint[]>([]);
  const [refLeftTap, setRefLeftTap] = useState<TapPoint | null>(null);
  const [refRightTap, setRefRightTap] = useState<TapPoint | null>(null);
  const [wallCorner1, setWallCorner1] = useState<TapPoint | null>(null);
  const [wallCorner2, setWallCorner2] = useState<TapPoint | null>(null);
  const [resultWidth, setResultWidth] = useState<number | null>(null);
  const [resultHeight, setResultHeight] = useState<number | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  // Start camera on mount
  useEffect(() => {
    if (!useXR) {
      camera.start().then(() => setCameraStarted(true));
    }
    return () => {
      // Only stop if we own the camera (no external instance provided)
      if (!externalCamera) {
        camera.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase instructions
  const phaseInstructions: Record<MeasurePhase, { title: string; subtitle: string }> = {
    calibrate_left: {
      title: "Tap LEFT edge of your tote",
      subtitle: "This calibrates the scale. Make sure the tote's short side faces you.",
    },
    calibrate_right: {
      title: "Tap RIGHT edge of your tote",
      subtitle: "Tap the right edge of the same tote face.",
    },
    corner_1: {
      title: "Tap bottom-left wall corner",
      subtitle: "Tap where the wall meets the floor on the left side.",
    },
    corner_2: {
      title: "Tap top-right wall corner",
      subtitle: "Tap where the wall meets the ceiling on the right side.",
    },
    done: {
      title: "Measurement Complete",
      subtitle: "Review the results below.",
    },
  };

  // Handle tap on the camera view
  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (phase === "done") return;

      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;

      let clientX: number, clientY: number;
      if ("touches" in e) {
        if (e.touches.length === 0) return;
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const px = clientX - rect.left;
      const py = clientY - rect.top;

      // Also forward to WebXR if active
      if (useXR && webxr.active) {
        webxr.handleTap(px, py);
      }

      const tap: TapPoint = { px, py, label: phase };

      setTaps((prev) => [...prev, tap]);

      switch (phase) {
        case "calibrate_left":
          setRefLeftTap(tap);
          setPhase("calibrate_right");
          break;
        case "calibrate_right":
          setRefRightTap(tap);
          setPhase("corner_1");
          break;
        case "corner_1":
          setWallCorner1(tap);
          setPhase("corner_2");
          break;
        case "corner_2": {
          setWallCorner2(tap);

          // Compute measurements
          if (refLeftTap && refRightTap) {
            const refPixelWidth = Math.abs(refRightTap.px - refLeftTap.px);

            if (refPixelWidth > 5) {
              // Width = horizontal pixel distance between corners, scaled
              const corner1 = wallCorner1!;
              const corner2Tap = tap;

              const wallPixelWidth = Math.abs(corner2Tap.px - corner1.px);
              const wallPixelHeight = Math.abs(corner2Tap.py - corner1.py);

              const inchesPerPixel = referenceWidthInches / refPixelWidth;
              const width = wallPixelWidth * inchesPerPixel;
              const height = wallPixelHeight * inchesPerPixel;

              // Sanity clamp
              const clampedWidth = Math.max(36, Math.min(width, 300));
              const clampedHeight = height > 30 ? Math.max(60, Math.min(height, 168)) : undefined;

              // Round to nearest 0.5"
              const finalWidth = Math.round(clampedWidth * 2) / 2;
              const finalHeight = clampedHeight
                ? Math.round(clampedHeight * 2) / 2
                : undefined;

              setResultWidth(finalWidth);
              setResultHeight(finalHeight ?? null);
            }
          }

          setPhase("done");
          break;
        }
      }
    },
    [phase, useXR, webxr, refLeftTap, refRightTap, wallCorner1, referenceWidthInches]
  );

  const handleReset = useCallback(() => {
    setPhase("calibrate_left");
    setTaps([]);
    setRefLeftTap(null);
    setRefRightTap(null);
    setWallCorner1(null);
    setWallCorner2(null);
    setResultWidth(null);
    setResultHeight(null);
    if (useXR) webxr.reset();
  }, [useXR, webxr]);

  const handleConfirm = useCallback(() => {
    if (resultWidth !== null) {
      onMeasured(resultWidth, resultHeight ?? undefined);
    }
  }, [resultWidth, resultHeight, onMeasured]);

  const info = phaseInstructions[phase];

  // Dot color for each phase
  function dotColor(tapLabel: string): string {
    switch (tapLabel) {
      case "calibrate_left":
      case "calibrate_right":
        return "bg-blue-400";
      case "corner_1":
        return "bg-green-400";
      case "corner_2":
        return "bg-red-400";
      default:
        return "bg-white";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Instructions */}
      <div className="text-center">
        <h3 className="text-lg font-bold text-white mb-1">{info.title}</h3>
        <p className="text-slate-400 text-sm">{info.subtitle}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {(["calibrate_left", "calibrate_right", "corner_1", "corner_2"] as MeasurePhase[]).map(
          (step, idx) => {
            const stepLabels = ["Ref L", "Ref R", "Corner 1", "Corner 2"];
            const phaseOrder: MeasurePhase[] = [
              "calibrate_left",
              "calibrate_right",
              "corner_1",
              "corner_2",
            ];
            const currentIdx = phaseOrder.indexOf(phase);
            const isComplete = idx < currentIdx || phase === "done";
            const isCurrent = idx === currentIdx && phase !== "done";

            return (
              <div key={step} className="flex items-center gap-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isComplete
                      ? "bg-green-500 text-white"
                      : isCurrent
                        ? "bg-yellow-400 text-slate-900"
                        : "bg-slate-700 text-slate-500"
                  }`}
                >
                  {isComplete ? <Check className="w-3 h-3" /> : idx + 1}
                </div>
                <span
                  className={`text-[10px] ${
                    isCurrent ? "text-yellow-400 font-medium" : "text-slate-500"
                  }`}
                >
                  {stepLabels[idx]}
                </span>
                {idx < 3 && (
                  <div
                    className={`w-3 h-0.5 ${
                      isComplete ? "bg-green-500" : "bg-slate-700"
                    }`}
                  />
                )}
              </div>
            );
          }
        )}
      </div>

      {/* Camera / AR View */}
      <div
        ref={overlayRef}
        onClick={phase !== "done" ? handleTap : undefined}
        onTouchEnd={phase !== "done" ? handleTap : undefined}
        className="relative aspect-[4/3] bg-slate-900 rounded-lg overflow-hidden cursor-crosshair select-none touch-none"
      >
        {/* Camera feed */}
        {!useXR && (
          <video
            ref={camera.videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}

        {/* WebXR canvas */}
        {useXR && (
          <canvas
            ref={canvasRef}
            className="w-full h-full"
          />
        )}

        {/* Camera loading state */}
        {!camera.isActive && !camera.error && !useXR && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
            <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
            <p className="mt-2 text-slate-400 text-sm">Starting camera...</p>
          </div>
        )}

        {/* Camera error */}
        {!useXR && camera.error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
            <ShieldAlert className="w-10 h-10 text-yellow-400 mb-3" />
            <p className="text-slate-300 text-sm text-center mb-2">
              Camera access is needed to measure your wall
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
              Allow Camera Access
            </button>
          </div>
        )}

        {/* Crosshair overlay */}
        {phase !== "done" && (camera.isActive || (useXR && webxr.active)) && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <Crosshair className="w-8 h-8 text-yellow-400/60" />
          </div>
        )}

        {/* Placed tap dots */}
        {taps.map((tap, i) => (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: tap.px - 6,
              top: tap.py - 6,
            }}
          >
            <div
              className={`w-3 h-3 rounded-full ${dotColor(tap.label)} ring-2 ring-white shadow-lg`}
            />
            <span className="absolute left-4 top-[-2px] text-[10px] font-bold text-white drop-shadow-md whitespace-nowrap">
              {tap.label === "calibrate_left"
                ? "Ref L"
                : tap.label === "calibrate_right"
                  ? "Ref R"
                  : tap.label === "corner_1"
                    ? "BL"
                    : "TR"}
            </span>
          </div>
        ))}

        {/* Reference line between calibration taps */}
        {refLeftTap && refRightTap && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <line
              x1={refLeftTap.px}
              y1={refLeftTap.py}
              x2={refRightTap.px}
              y2={refRightTap.py}
              stroke="#60a5fa"
              strokeWidth="2"
              strokeDasharray="6 3"
            />
            <text
              x={(refLeftTap.px + refRightTap.px) / 2}
              y={(refLeftTap.py + refRightTap.py) / 2 - 8}
              fill="white"
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
            >
              {referenceWidthInches}&quot; ref
            </text>
          </svg>
        )}

        {/* Wall measurement lines */}
        {wallCorner1 && wallCorner2 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {/* Horizontal (width) */}
            <line
              x1={wallCorner1.px}
              y1={wallCorner1.py}
              x2={wallCorner2.px}
              y2={wallCorner1.py}
              stroke="#4ade80"
              strokeWidth="2"
            />
            {/* Vertical (height) */}
            <line
              x1={wallCorner2.px}
              y1={wallCorner1.py}
              x2={wallCorner2.px}
              y2={wallCorner2.py}
              stroke="#60a5fa"
              strokeWidth="2"
            />
            {/* Diagonal */}
            <line
              x1={wallCorner1.px}
              y1={wallCorner1.py}
              x2={wallCorner2.px}
              y2={wallCorner2.py}
              stroke="white"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.5"
            />
            {/* Width label */}
            {resultWidth && (
              <text
                x={(wallCorner1.px + wallCorner2.px) / 2}
                y={wallCorner1.py + 16}
                fill="#4ade80"
                fontSize="13"
                fontWeight="bold"
                textAnchor="middle"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
              >
                {resultWidth.toFixed(1)}&quot; wide
              </text>
            )}
            {/* Height label */}
            {resultHeight && (
              <text
                x={wallCorner2.px + 8}
                y={(wallCorner1.py + wallCorner2.py) / 2}
                fill="#60a5fa"
                fontSize="13"
                fontWeight="bold"
                textAnchor="start"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
              >
                {resultHeight.toFixed(1)}&quot; tall
              </text>
            )}
          </svg>
        )}

        {/* Tap hint */}
        {phase !== "done" && (camera.isActive || (useXR && webxr.active)) && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/70 rounded-full">
            <p className="text-white text-xs font-medium flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5" />
              Tap to place point
            </p>
          </div>
        )}
      </div>

      {/* Results / Actions */}
      {phase === "done" && resultWidth !== null && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-sm font-semibold text-green-400">
              Measurement Complete
            </span>
            {useXR && (
              <span className="ml-auto text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-medium">
                AR
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-[10px] uppercase text-slate-500 font-semibold">Width</p>
              <p className="text-xl font-bold text-green-400">
                {resultWidth.toFixed(1)}&quot;
              </p>
              <p className="text-[10px] text-slate-500">
                ({(resultWidth / 12).toFixed(1)} ft)
              </p>
            </div>
            {resultHeight && (
              <div className="rounded-lg bg-slate-800 p-3 text-center">
                <p className="text-[10px] uppercase text-slate-500 font-semibold">Height</p>
                <p className="text-xl font-bold text-blue-400">
                  {resultHeight.toFixed(1)}&quot;
                </p>
                <p className="text-[10px] text-slate-500">
                  ({(resultHeight / 12).toFixed(1)} ft)
                </p>
              </div>
            )}
          </div>

          <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-3 py-2 mb-4">
            <p className="text-yellow-300 text-xs">
              <strong>Tip:</strong> For best accuracy, keep your phone level and
              parallel to the wall. You can adjust the final dimensions on the
              next screen.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Redo
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-yellow-400 text-slate-900 font-semibold rounded-lg hover:bg-yellow-300 transition-colors"
            >
              <Check className="w-4 h-4" />
              Use Measurements
            </button>
          </div>
        </div>
      )}

      {/* Cancel */}
      {phase !== "done" && (
        <button
          onClick={onCancel}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors text-center"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
