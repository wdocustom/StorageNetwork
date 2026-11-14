// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM STORAGE BUILDER — /plans/builder
//
// Design any storage piece from real materials (2×4s, ripped 2×4s, plywood)
// in a plan view and in 3D. The page is only a shell: the workspace and all
// of its state are in @/components/builder and @/hooks/builder, and the
// design itself is the scene graph in @/lib/builder/scene.
// ═══════════════════════════════════════════════════════════════════════════

import BuilderWorkspace from "@/components/builder/BuilderWorkspace";

export default function CustomBuilderPage() {
  return <BuilderWorkspace />;
}
