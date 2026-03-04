"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useCameraStream — Shared hook for camera access with robust lifecycle
//
// Handles: getUserMedia, permission tracking, error classification,
// auto-retry on permission grant, and clean teardown.
// ═══════════════════════════════════════════════════════════════════════════

export type CameraError =
  | "unsupported"     // No getUserMedia (HTTP, old browser)
  | "denied"          // User blocked camera permission
  | "not-found"       // Device has no camera
  | "in-use"          // Camera held by another app/tab
  | "unknown";        // Catch-all

export type PermissionState = "prompt" | "denied" | "granted" | "unknown";

export interface CameraStreamState {
  /** Whether the camera feed is actively streaming */
  isActive: boolean;
  /** Classified error (null when no error) */
  error: CameraError | null;
  /** Browser permission state for camera */
  permissionState: PermissionState;
  /** How many times startCamera has failed consecutively */
  retryCount: number;
}

export interface UseCameraStreamReturn extends CameraStreamState {
  /** Ref to attach to a <video> element */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Request camera access and start streaming */
  start: () => Promise<void>;
  /** Stop the camera and release all tracks */
  stop: () => void;
  /** User-friendly error message for the current error */
  errorMessage: string | null;
}

/** Classify a getUserMedia error into our known categories */
function classifyError(err: unknown): CameraError {
  if (err instanceof Error && err.message === "UNSUPPORTED") return "unsupported";
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "denied";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "not-found";
      case "NotReadableError":
      case "TrackStartError":
      case "AbortError":
        return "in-use";
    }
  }
  return "unknown";
}

/** Map error type to a clear, actionable message */
function getErrorMessage(error: CameraError | null): string | null {
  switch (error) {
    case "unsupported":
      return "Camera is not available in this browser. Make sure you\u2019re using HTTPS.";
    case "denied":
      return "Camera access was denied. Tap the lock icon in your browser\u2019s address bar to allow camera access, then reload the page.";
    case "not-found":
      return "No camera found on this device.";
    case "in-use":
      return "Camera is in use by another app. Close other apps using the camera and try again.";
    case "unknown":
      return "Could not access camera. Please try again.";
    case null:
      return null;
  }
}

interface UseCameraStreamOptions {
  /** Camera facing mode (default: "environment" for rear camera) */
  facingMode?: "environment" | "user";
  /** Ideal video width (default: 1920) */
  idealWidth?: number;
  /** Ideal video height (default: 1080) */
  idealHeight?: number;
}

export function useCameraStream(options: UseCameraStreamOptions = {}): UseCameraStreamReturn {
  const {
    facingMode = "environment",
    idealWidth = 1920,
    idealHeight = 1080,
  } = options;

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>("unknown");
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null!);  // non-null assertion for React ref compatibility
  const streamRef = useRef<MediaStream | null>(null);

  // ── Permission state query ────────────────────────────────────────────
  const queryPermission = useCallback(async (): Promise<PermissionState> => {
    try {
      if (!navigator.permissions) return "unknown";
      const status = await navigator.permissions.query({ name: "camera" as PermissionName });
      const state = status.state as PermissionState;
      setPermissionState(state);
      return state;
    } catch {
      setPermissionState("unknown");
      return "unknown";
    }
  }, []);

  // ── Stop camera ───────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  // ── Start camera ─────────────────────────────────────────────────────
  const start = useCallback(async () => {
    try {
      // Pre-flight: check API availability
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("UNSUPPORTED");
      }

      // Tear down any existing stream first
      stop();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: idealWidth }, height: { ideal: idealHeight } },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
      setError(null);
      setPermissionState("granted");
      setRetryCount(0);
    } catch (err) {
      console.error("Camera error:", err);
      const classified = classifyError(err);
      setError(classified);
      setIsActive(false);
      setRetryCount((c) => c + 1);
      await queryPermission();
    }
  }, [facingMode, idealWidth, idealHeight, stop, queryPermission]);

  // ── Listen for permission changes (user toggling in browser settings) ─
  useEffect(() => {
    let cancelled = false;
    let statusObj: PermissionStatus | null = null;
    let handler: (() => void) | null = null;

    const listen = async () => {
      try {
        if (!navigator.permissions) return;
        statusObj = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (cancelled) return;

        handler = () => {
          if (cancelled || !statusObj) return;
          const newState = statusObj.state as PermissionState;
          setPermissionState(newState);
          // Auto-retry when permission is freshly granted
          if (newState === "granted") {
            setError(null);
            setRetryCount(0);
            start();
          }
        };
        statusObj.addEventListener("change", handler);
      } catch {
        // Permissions API not supported for camera
      }
    };

    listen();
    return () => {
      cancelled = true;
      if (statusObj && handler) {
        statusObj.removeEventListener("change", handler);
      }
    };
  }, [start]);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    videoRef,
    isActive,
    error,
    permissionState,
    retryCount,
    errorMessage: getErrorMessage(error),
    start,
    stop,
  };
}
