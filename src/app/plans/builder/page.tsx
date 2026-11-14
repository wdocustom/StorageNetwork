// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM STORAGE BUILDER — /plans/builder
//
// Design any storage piece from real materials (2×4s, ripped 2×4s, plywood)
// in a plan view and in 3D. The page is only a shell: the workspace and all
// of its state are in @/components/builder and @/hooks/builder, and the
// design itself is the scene graph in @/lib/builder/scene.
// ═══════════════════════════════════════════════════════════════════════════

import type { Viewport } from "next";
import BuilderWorkspace from "@/components/builder/BuilderWorkspace";

// A drawing surface: pinch and double-tap belong to the views, not the page.
// (Set here, not in the layout, so the pages under /plans/builder stay zoomable.)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function CustomBuilderPage() {
  return <BuilderWorkspace />;
}
