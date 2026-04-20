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
  | "timeout"         // getUserMedia hung (permission prompt dismissed, etc.)
  | "not-ready"       // Video element not in DOM when stream was ready
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
  if (err instanceof Error) {
    if (err.message === "UNSUPPORTED") return "unsupported";
    if (err.message === "TIMEOUT") return "timeout";
    if (err.message === "VIDEO_NOT_READY") return "not-ready";
  }
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
    case "timeout":
      return "Camera did not respond in time. Please tap 'Try Again' or reload the page.";
    case "not-ready":
      return "Camera started before the page was ready. Please tap 'Try Again'.";
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

      // Wrap getUserMedia with a timeout to prevent hanging indefinitely
      // (mobile browsers can stall if permission prompt is dismissed)
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: idealWidth }, height: { ideal: idealHeight } },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), 15000)
        ),
      ]);

      streamRef.current = stream;

      // Wait for the video ref to be set if it isn't yet (can happen when
      // the camera instance is shared across components and start() fires
      // before React has committed the new <video> element to the DOM).
      if (!videoRef.current) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        // Ensure muted is set programmatically — some browsers (especially
        // incognito mode) require this for autoplay to succeed.
        video.muted = true;

        // Wait for the stream metadata to load before calling play().
        // Without this, play() can hang indefinitely in incognito/strict contexts.
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("TIMEOUT")), 10000);
          if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            clearTimeout(timeout);
            resolve();
          } else {
            video.onloadedmetadata = () => {
              clearTimeout(timeout);
              video.onloadedmetadata = null;
              resolve();
            };
          }
        });

        await Promise.race([
          video.play(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("TIMEOUT")), 5000)
          ),
        ]);
      } else {
        // Video element not yet in DOM — stop tracks to avoid orphaned stream
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("VIDEO_NOT_READY");
      }

      setIsActive(true);
      setError(null);
      setPermissionState("granted");
      setRetryCount(0);
    } catch (err) {
      console.error("Camera error:", err);
      // Release stream/tracks so the camera LED turns off on failure
      stop();
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
