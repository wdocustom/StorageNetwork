// ═══════════════════════════════════════════════════════════════════════════
// WebXR Type Declarations (subset used by useWebXRMeasure hook)
//
// The WebXR Device API types are not included in TypeScript's default DOM lib.
// These declarations cover the interfaces used for immersive-ar hit-testing.
// ═══════════════════════════════════════════════════════════════════════════

interface XRSystem {
  isSessionSupported(mode: XRSessionMode): Promise<boolean>;
  requestSession(
    mode: XRSessionMode,
    options?: XRSessionInit
  ): Promise<XRSession>;
}

type XRSessionMode = "inline" | "immersive-vr" | "immersive-ar";

interface XRSessionInit {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
}

interface XRSession extends EventTarget {
  requestReferenceSpace(type: XRReferenceSpaceType): Promise<XRReferenceSpace>;
  requestHitTestSource?(
    options: XRHitTestOptionsInit
  ): Promise<XRHitTestSource>;
  requestAnimationFrame(callback: XRFrameRequestCallback): number;
  updateRenderState(state: XRRenderStateInit): void;
  end(): Promise<void>;
  renderState: XRRenderState;
}

type XRReferenceSpaceType =
  | "viewer"
  | "local"
  | "local-floor"
  | "bounded-floor"
  | "unbounded";

interface XRReferenceSpace extends EventTarget {
  getOffsetReferenceSpace(originOffset: XRRigidTransform): XRReferenceSpace;
}

interface XRHitTestOptionsInit {
  space: XRReferenceSpace;
  offsetRay?: XRRay;
}

interface XRHitTestSource {
  cancel(): void;
}

interface XRFrame {
  getHitTestResults(hitTestSource: XRHitTestSource): XRHitTestResult[];
  getViewerPose(referenceSpace: XRReferenceSpace): XRViewerPose | null;
}

interface XRHitTestResult {
  getPose(baseSpace: XRReferenceSpace): XRPose | null;
}

interface XRPose {
  transform: XRRigidTransform;
}

interface XRViewerPose extends XRPose {
  views: XRView[];
}

interface XRView {
  eye: "left" | "right" | "none";
  projectionMatrix: Float32Array;
  transform: XRRigidTransform;
}

interface XRRigidTransform {
  position: DOMPointReadOnly;
  orientation: DOMPointReadOnly;
  matrix: Float32Array;
  inverse: XRRigidTransform;
}

interface XRRay {
  origin: DOMPointReadOnly;
  direction: DOMPointReadOnly;
  matrix: Float32Array;
}

interface XRRenderState {
  baseLayer?: XRWebGLLayer;
}

interface XRRenderStateInit {
  baseLayer?: XRWebGLLayer;
  depthFar?: number;
  depthNear?: number;
}

declare class XRWebGLLayer {
  constructor(session: XRSession, context: WebGLRenderingContext);
  framebuffer: WebGLFramebuffer;
  framebufferWidth: number;
  framebufferHeight: number;
}

type XRFrameRequestCallback = (
  time: DOMHighResTimeStamp,
  frame: XRFrame
) => void;

interface Navigator {
  xr?: XRSystem;
}
