"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — inspector
//
// Exact numbers for whatever is selected:
//   • one piece   name, material, cut size (length, rip width, plywood
//                 thickness), position measured to its edges, how it sits
//                 and turns, and any advice about buying or cutting it
//   • several     turn, drop, duplicate or delete them together
//   • nothing     a summary of the whole design
//
// Length fields take what a builder would type (34 1/2, 2' 6", 30.5) and
// show tape-measure fractions.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  Copy,
  Info,
  MousePointerClick,
  RotateCw,
  Trash2,
} from "lucide-react";
import { HALF_RIP_WIDTH, getStock, sameKindStocks } from "@/lib/builder/catalog";
import {
  orientationOf,
  pieceBounds,
  pieceLabel,
  pieceWarnings,
  summarize,
  type Orientation,
  type Scene,
  type ScenePiece,
} from "@/lib/builder/scene";
import { formatFeetInches, formatFraction, formatInches, parseLength } from "@/lib/builder/units";
import type { BuilderActions } from "@/hooks/builder/useBuilder";

// ── Fields ───────────────────────────────────────────────────────────────

const FIELD =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white outline-none transition focus:border-yellow-400";

/** A text field that commits on Enter or blur and snaps back if it can't read the entry. */
function CommitField({
  label,
  hint,
  shown,
  parse,
  onCommit,
  inputMode = "text",
  suffix,
}: {
  label: string;
  hint?: string;
  /** The current value as text */
  shown: string;
  parse: (text: string) => number | null;
  onCommit: (value: number) => void;
  inputMode?: "text" | "decimal";
  suffix?: string;
}) {
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);

  const commit = () => {
    const value = parse(draft);
    if (value === null) setDraft(shown);
    else onCommit(value);
  };

  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-wider text-stone-500">
        {label}
        {hint && <span className="font-normal normal-case tracking-normal text-stone-600">{hint}</span>}
      </span>
      <span className="relative block">
        <input
          type="text"
          inputMode={inputMode}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(shown);
              e.currentTarget.blur();
            }
          }}
          onFocus={(e) => e.currentTarget.select()}
          className={`${FIELD} ${suffix ? "pr-7" : ""} font-mono`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-500">{suffix}</span>
        )}
      </span>
    </label>
  );
}

/** A length in inches. `compact` drops the "in" so three fit side by side. */
function LengthField(props: {
  label: string;
  hint?: string;
  value: number;
  onCommit: (inches: number) => void;
  compact?: boolean;
}) {
  return (
    <CommitField
      label={props.label}
      hint={props.hint}
      shown={formatFraction(props.value)}
      parse={parseLength}
      onCommit={props.onCommit}
      suffix={props.compact ? undefined : "in"}
    />
  );
}

function parseAngle(text: string): number | null {
  const t = text.trim().replace(/°$/, "");
  return /^-?\d*\.?\d+$/.test(t) ? Number(t) : null;
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">{children}</h3>;
}

function ToolButton({
  onClick,
  children,
  tone = "default",
  active,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "danger";
  active?: boolean;
  title?: string;
}) {
  const color = active
    ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
    : tone === "danger"
      ? "border-slate-700 text-red-300 hover:border-red-400/60 hover:bg-red-500/10"
      : "border-slate-700 text-stone-200 hover:border-yellow-400/50 hover:text-yellow-300";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-bold transition ${color}`}
    >
      {children}
    </button>
  );
}

// ── Shared action rows ───────────────────────────────────────────────────

function TurnButtons({ actions }: { actions: BuilderActions }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <ToolButton onClick={() => actions.rotate("y", 90)} title="Quarter turn on the floor (R)">
        <RotateCw className="h-3.5 w-3.5" /> Turn
      </ToolButton>
      <ToolButton onClick={() => actions.rotate("x", 90)} title="Tip it forward a quarter turn">
        Tip
      </ToolButton>
      <ToolButton onClick={() => actions.rotate("z", 90)} title="Stand it up / lay it down a quarter turn">
        Stand
      </ToolButton>
    </div>
  );
}

function SelectionActions({ actions }: { actions: BuilderActions }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <ToolButton onClick={actions.dropToFloor} title="Rest it on the floor">
        <ArrowDownToLine className="h-3.5 w-3.5" /> Floor
      </ToolButton>
      <ToolButton onClick={actions.duplicate} title="Duplicate (Ctrl/⌘ D)">
        <Copy className="h-3.5 w-3.5" /> Copy
      </ToolButton>
      <ToolButton onClick={actions.deleteSelection} tone="danger" title="Delete (Del)">
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </ToolButton>
    </div>
  );
}

// ── One piece ────────────────────────────────────────────────────────────

const ORIENTATIONS: { id: Orientation; label: string }[] = [
  { id: "flat", label: "Flat" },
  { id: "edge", label: "On edge" },
  { id: "upright", label: "Upright" },
];

function PieceInspector({ piece, actions }: { piece: ScenePiece; actions: BuilderActions }) {
  const stock = getStock(piece.stock);
  const [name, setName] = useState(piece.name ?? "");
  useEffect(() => setName(piece.name ?? ""), [piece.id, piece.name]);
  if (!stock) return null;

  const low = pieceBounds(piece).min;
  const warnings = pieceWarnings(piece);
  const orientation = orientationOf(piece);
  const thicknesses = sameKindStocks(piece.stock);
  const rips = [
    { label: 'Full 3-1/2"', width: stock.width },
    { label: 'Half 1-9/16"', width: HALF_RIP_WIDTH },
    { label: '1-1/2"', width: 1.5 },
  ];

  return (
    <div className="space-y-5">
      <div>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-stone-500">Name</span>
          <input
            type="text"
            value={name}
            placeholder={pieceLabel({ ...piece, name: undefined })}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => actions.renamePiece(piece.id, name)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className={FIELD}
          />
        </label>
        <p className="mt-1.5 text-[11px] text-stone-500">{stock.description}</p>
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1.5">
          {warnings.map((w) => (
            <li
              key={w.text}
              className={`flex gap-2 rounded-lg p-2.5 text-[11px] leading-snug ${
                w.level === "warn" ? "bg-amber-400/10 text-amber-200" : "bg-sky-400/10 text-sky-200"
              }`}
            >
              {w.level === "warn" ? (
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              ) : (
                <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              )}
              {w.text}
            </li>
          ))}
        </ul>
      )}

      <section>
        <Heading>Cut size</Heading>
        <div className="grid grid-cols-2 gap-2">
          <LengthField
            label="Length"
            hint={piece.length >= 48 ? formatFeetInches(piece.length) : undefined}
            value={piece.length}
            onCommit={(length) => actions.resize(piece.id, { length })}
          />
          <LengthField
            label={stock.kind === "lumber" ? "Width (rip)" : "Width"}
            value={piece.width}
            onCommit={(width) => actions.resize(piece.id, { width })}
          />
        </div>
        {stock.kind === "lumber" ? (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {rips.map((r) => (
              <ToolButton
                key={r.label}
                onClick={() => actions.resize(piece.id, { width: r.width })}
                active={Math.abs(piece.width - r.width) < 1e-6}
              >
                {r.label}
              </ToolButton>
            ))}
          </div>
        ) : (
          <label className="mt-2 block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-stone-500">Thickness</span>
            <select
              value={piece.stock}
              onChange={(e) => actions.setStock(piece.id, e.target.value)}
              className={FIELD}
            >
              {thicknesses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {stock.kind === "lumber" && (
          <p className="mt-1.5 text-[10px] text-stone-600">Thickness is always {formatInches(stock.thickness)}.</p>
        )}
      </section>

      <section>
        <Heading>Position</Heading>
        <div className="grid grid-cols-3 gap-2">
          <LengthField compact label="Left" value={low[0]} onCommit={(v) => actions.setEdge(piece.id, "x", v)} />
          <LengthField compact label="Off floor" value={low[1]} onCommit={(v) => actions.setEdge(piece.id, "y", v)} />
          <LengthField compact label="Back" value={low[2]} onCommit={(v) => actions.setEdge(piece.id, "z", v)} />
        </div>
        <p className="mt-1.5 text-[10px] text-stone-600">
          Inches to the piece&apos;s left edge, underside and back edge.
        </p>
      </section>

      <section>
        <Heading>How it sits</Heading>
        <div className="grid grid-cols-3 gap-1.5">
          {ORIENTATIONS.map((o) => (
            <ToolButton key={o.id} onClick={() => actions.setOrientation(piece.id, o.id)} active={orientation === o.id}>
              {o.label}
            </ToolButton>
          ))}
        </div>
        <div className="mt-2">
          <TurnButtons actions={actions} />
        </div>
        <div className="mt-2">
          <CommitField
            label="Angle on the floor"
            hint="any angle"
            shown={String(piece.rotation[1])}
            parse={parseAngle}
            inputMode="text"
            suffix="°"
            onCommit={(y) => actions.setRotation(piece.id, [piece.rotation[0], y, piece.rotation[2]])}
          />
        </div>
      </section>

      <SelectionActions actions={actions} />
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────

export default function BuilderInspector({
  scene,
  selected,
  actions,
}: {
  scene: Scene;
  selected: ScenePiece[];
  actions: BuilderActions;
}) {
  if (selected.length === 1) return <PieceInspector piece={selected[0]} actions={actions} />;

  if (selected.length > 1) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-sm font-bold text-white">{selected.length} pieces selected</p>
          <p className="mt-1 text-[11px] text-stone-500">They move and turn together, about the middle of the selection.</p>
        </div>
        <section>
          <Heading>Turn together</Heading>
          <TurnButtons actions={actions} />
        </section>
        <SelectionActions actions={actions} />
      </div>
    );
  }

  const s = summarize(scene);
  return (
    <div className="space-y-5">
      {s.pieceCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-4 text-center">
          <MousePointerClick className="mx-auto mb-2 h-5 w-5 text-yellow-400" />
          <p className="text-sm font-bold text-white">Start with a board</p>
          <p className="mt-1 text-[11px] leading-snug text-stone-500">
            Add a 2×4 or a plywood panel from the library, then drag it into place and set its exact size here.
          </p>
        </div>
      ) : (
        <>
          <section>
            <Heading>This design</Heading>
            <dl className="space-y-1.5 text-xs">
              {[
                ["Pieces", String(s.pieceCount)],
                ["Overall", s.size ? `${formatInches(s.size[0])} W × ${formatInches(s.size[1])} H × ${formatInches(s.size[2])} D` : "—"],
                ["2×4 in the build", formatFeetInches(s.lumberInches)],
                ["Plywood", `${(s.sheetSquareInches / 144).toFixed(1)} sq ft`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-stone-500">{label}</dt>
                  <dd className="text-right font-mono font-semibold text-stone-200">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          {s.warningCount > 0 && (
            <p className="flex gap-2 rounded-lg bg-amber-400/10 p-2.5 text-[11px] leading-snug text-amber-200">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {s.warningCount} piece{s.warningCount === 1 ? "" : "s"} can&apos;t be bought or cut as drawn. Select a piece to see why.
            </p>
          )}
          <p className="text-[11px] leading-snug text-stone-500">Select a piece to set its exact size and position.</p>
        </>
      )}
    </div>
  );
}
