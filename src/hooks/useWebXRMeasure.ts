"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useWebXRMeasure — WebXR hit-test based wall measurement
//
// Uses WebXR's "immersive-ar" session with hit-testing to let the user tap
// two points on a wall. The real-world distance between those points is
// computed from the 3D positions returned by the XR hit-test API.
//
// Fallback: When WebXR is unavailable (most mobile browsers without ARCore/
// ARKit integration), this hook reports `supported: false` so the caller can
// offer the camera-tap-with-reference-object approach instead.
// ═══════════════════════════════════════════════════════════════════════════

export interface XRPoint {
  x: number;
  y: number;
  z: number;
}

export interface WebXRMeasureState {
  supported: boolean | null; // null = still checking
  active: boolean;
  points: XRPoint[];
  distanceMeters: number | null;
  distanceInches: number | null;
  error: string | null;
}

export interface UseWebXRMeasureReturn extends WebXRMeasureState {
  /** Start the XR session */
  start: (canvas: HTMLCanvasElement) => Promise<void>;
  /** End the XR session */
  stop: () => void;
  /** Clear placed points to start over */
  reset: () => void;
  /** Handle a user tap during the XR session */
  handleTap: (x: number, y: number) => void;
}

const METERS_TO_INCHES = 39.3701;

export function useWebXRMeasure(): UseWebXRMeasureReturn {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [points, setPoints] = useState<XRPoint[]>([]);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [distanceInches, setDistanceInches] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<XRSession | null>(null);
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null);
  const refSpaceRef = useRef<XRReferenceSpace | null>(null);
  const viewerSpaceRef = useRef<XRReferenceSpace | null>(null);
  const lastHitRef = useRef<XRPoint | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);

  // Check support on mount
  useEffect(() => {
    if (typeof navigator === "undefined" || !("xr" in navigator)) {
      setSupported(false);
      return;
    }
    navigator.xr!
      .isSessionSupported("immersive-ar")
      .then((ok) => setSupported(ok))
      .catch(() => setSupported(false));
  }, []);

  const stop = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.end().catch(() => {});
      sessionRef.current = null;
    }
    hitTestSourceRef.current = null;
    refSpaceRef.current = null;
    viewerSpaceRef.current = null;
    lastHitRef.current = null;
    setActive(false);
  }, []);

  const reset = useCallback(() => {
    setPoints([]);
    setDistanceMeters(null);
    setDistanceInches(null);
    lastHitRef.current = null;
  }, []);

  const start = useCallback(
    async (canvas: HTMLCanvasElement) => {
      try {
        if (!navigator.xr) {
          throw new Error("WebXR not available");
        }

        const gl = canvas.getContext("webgl", { xrCompatible: true });
        if (!gl) throw new Error("WebGL context failed");
        glRef.current = gl;

        const session = await navigator.xr.requestSession("immersive-ar", {
          requiredFeatures: ["hit-test"],
          optionalFeatures: ["dom-overlay"],
        });

        sessionRef.current = session;

        session.updateRenderState({
          baseLayer: new XRWebGLLayer(session, gl),
        });

        const refSpace = await session.requestReferenceSpace("local");
        refSpaceRef.current = refSpace;

        const viewerSpace = await session.requestReferenceSpace("viewer");
        viewerSpaceRef.current = viewerSpace;

        const hitTestSource = await session.requestHitTestSource!({
          space: viewerSpace,
        });
        hitTestSourceRef.current = hitTestSource ?? null;

        // Frame loop — keep the session alive and track hit results
        const onFrame = (_time: number, frame: XRFrame) => {
          if (!sessionRef.current) return;
          sessionRef.current.requestAnimationFrame(onFrame);

          const hitResults = frame.getHitTestResults(hitTestSourceRef.current!);
          if (hitResults.length > 0) {
            const pose = hitResults[0].getPose(refSpaceRef.current!);
            if (pose) {
              const p = pose.transform.position;
              lastHitRef.current = { x: p.x, y: p.y, z: p.z };
            }
          }

          // Render pass (required to keep session alive even if we don't draw)
          const glLayer = session.renderState.baseLayer;
          if (glLayer && glRef.current) {
            glRef.current.bindFramebuffer(
              glRef.current.FRAMEBUFFER,
              glLayer.framebuffer
            );
            glRef.current.clear(glRef.current.COLOR_BUFFER_BIT | glRef.current.DEPTH_BUFFER_BIT);
          }
        };

        session.requestAnimationFrame(onFrame);

        session.addEventListener("end", () => {
          setActive(false);
          sessionRef.current = null;
        });

        reset();
        setActive(true);
        setError(null);
      } catch (err) {
        console.error("WebXR start error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to start AR session"
        );
        stop();
      }
    },
    [stop, reset]
  );

  const handleTap = useCallback(
    (_x: number, _y: number) => {
      if (!lastHitRef.current) return;

      const newPoint = { ...lastHitRef.current };

      setPoints((prev) => {
        const updated = [...prev, newPoint];

        if (updated.length === 2) {
          const [a, b] = updated;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          setDistanceMeters(dist);
          setDistanceInches(dist * METERS_TO_INCHES);
        }

        // Only keep 2 points max
        return updated.slice(0, 2);
      });
    },
    []
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.end().catch(() => {});
      }
    };
  }, []);

  return {
    supported,
    active,
    points,
    distanceMeters,
    distanceInches,
    error,
    start,
    stop,
    reset,
    handleTap,
  };
}
