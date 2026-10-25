"use client";

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM MAP — front elevation of a tote plan design, drawn to scale
//
// Same layout as the PDF's map (designLayout). Modules show their type
// letter and tote openings; highlighted modules glow in brand yellow.
// Used by the plans designer, the build page and the 3D guide's corner map.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { designLayout, type LayoutModule, type TotePlanDesign } from "@/lib/tote-plans";
import { toFraction } from "@/lib/utils";

export default function SystemMap({
  design,
  highlight,
  dimensions = false,
  tone = "dark",
  className,
  title,
}: {
  design: TotePlanDesign;
  highlight?: (m: LayoutModule) => boolean;
  dimensions?: boolean;
  tone?: "dark" | "light";
  className?: string;
  title?: string;
}) {
  const layout = useMemo(() => designLayout(design), [design]);
  const pad = 4;
  const dimH = dimensions ? 14 : 0;
  const vbW = layout.widthIn + pad * 2;
  const vbH = layout.heightIn + pad * 2 + dimH;
  const floor = pad + layout.heightIn;
  const stroke = Math.max(0.6, layout.widthIn / 260);

  const c =
    tone === "dark"
      ? { fill: "#1e293b", line: "#64748b", grid: "#334155", text: "#e2e8f0", litFill: "#facc15", litLine: "#fde047", litText: "#0f172a", floor: "#334155", dim: "#94a3b8" }
      : { fill: "#f1f5f9", line: "#64748b", grid: "#cbd5e1", text: "#0f172a", litFill: "#fef08a", litLine: "#a16207", litText: "#713f12", floor: "#cbd5e1", dim: "#64748b" };

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className={className}
      role="img"
      aria-label={title ?? "Map of your storage system"}
      preserveAspectRatio="xMidYMid meet"
    >
      <line x1={0} x2={vbW} y1={floor} y2={floor} stroke={c.floor} strokeWidth={stroke} />

      {layout.units.flatMap((u) =>
        u.casters.map((cx) => (
          <circle key={`caster-${u.unitIndex}-${cx}`} cx={pad + cx} cy={floor - 1.3} r={1.3} fill={c.dim} />
        )),
      )}

      {layout.modules.map((m) => {
        const lit = highlight?.(m) ?? false;
        const x = pad + m.x;
        const y = floor - m.y - m.h;
        const cellW = m.w / m.cols;
        const cellH = m.h / m.rows;
        const fontSize = Math.min(m.w, m.h) * 0.42;
        return (
          <g key={m.key}>
            <rect
              x={x}
              y={y}
              width={m.w}
              height={m.h}
              fill={lit ? c.litFill : c.fill}
              stroke={lit ? c.litLine : c.line}
              strokeWidth={lit ? stroke * 1.8 : stroke}
              style={{ transition: "fill 200ms, stroke 200ms" }}
            />
            {Array.from({ length: m.cols - 1 }, (_, i) => (
              <line key={`c${i}`} x1={x + (i + 1) * cellW} x2={x + (i + 1) * cellW} y1={y + 1} y2={y + m.h - 1} stroke={lit ? c.litLine : c.grid} strokeWidth={stroke * 0.5} opacity={0.6} />
            ))}
            {Array.from({ length: m.rows - 1 }, (_, i) => (
              <line key={`r${i}`} x1={x + 1} x2={x + m.w - 1} y1={y + (i + 1) * cellH} y2={y + (i + 1) * cellH} stroke={lit ? c.litLine : c.grid} strokeWidth={stroke * 0.5} opacity={0.6} />
            ))}
            <text
              x={x + m.w / 2}
              y={y + m.h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontWeight={900}
              fill={lit ? c.litText : c.text}
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              {m.type}
            </text>
          </g>
        );
      })}

      {layout.units.map((u) =>
        u.hasTop ? (
          <rect key={`top-${u.unitIndex}`} x={pad + u.x - 0.5} y={floor - u.h - 1.6} width={u.w + 1} height={1.6} fill="#d9b482" />
        ) : null,
      )}

      {dimensions &&
        layout.units.map((u) => (
          <text
            key={`dim-${u.unitIndex}`}
            x={pad + u.x + u.w / 2}
            y={floor + 9}
            textAnchor="middle"
            fontSize={Math.max(5, Math.min(9, layout.widthIn / 22))}
            fill={c.dim}
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            {toFraction(u.w)}&quot;
          </text>
        ))}
    </svg>
  );
}
