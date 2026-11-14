"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — inspector
//
// Exact numbers and tools for whatever is selected:
//   • one piece   name, material, cut size (length, rip width, plywood
//                 thickness), position measured to its edges, how it sits
//                 and turns, cutting it in two, and any advice about
//                 buying, cutting or overlapping
//   • several     size of the selection, the gap between two things,
//                 align / space evenly / mirror / turn, group and ungroup
//   • nothing     a summary of the whole design
//
// Basic tools are always showing; the less common ones (cut in two, align
// and space, mirror) sit in sections that open when wanted.
//
// Length fields take what a builder would type (34 1/2, 2' 6", 30.5) and
// show tape-measure fractions.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ChevronDown,
  Copy,
  FlipHorizontal2,
  Group,
  Info,
  MousePointerClick,
  RotateCw,
  Scissors,
  Trash2,
  Ungroup,
} from "lucide-react";
import type { BuilderActions, SelectionInfo } from "@/hooks/builder/useBuilder";
import { HALF_RIP_WIDTH, getStock, sameKindStocks } from "@/lib/builder/catalog";
import {
  SAW_KERF,
  gapBetween,
  orientationOf,
  pieceBounds,
  pieceLabel,
  pieceWarnings,
  summarize,
  type AlignMode,
  type Axis,
  type Orientation,
  type Scene,
  type ScenePiece,
} from "@/lib/builder/scene";
import { formatFeetInches, formatFraction, formatInches, parseLength } from "@/lib/builder/units";

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
  suffix,
}: {
  label: string;
  hint?: string;
  /** The current value as text */
  shown: string;
  parse: (text: string) => number | null;
  onCommit: (value: number) => void;
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

/** A name that saves on Enter or blur. */
function NameField({ label, value, placeholder, onCommit }: { label: string; value: string; placeholder?: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-stone-500">{label}</span>
      <input
        type="text"
        value={draft}
        placeholder={placeholder}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={FIELD}
      />
    </label>
  );
}

function parseAngle(text: string): number | null {
  const t = text.trim().replace(/°$/, "");
  return /^-?\d*\.?\d+$/.test(t) ? Number(t) : null;
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">{children}</h3>;
}

/** A section that stays closed until it's wanted. */
function Disclosure({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-slate-800 bg-slate-900/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-stone-300 [&::-webkit-details-marker]:hidden">
        {icon}
        <span className="flex-1">{title}</span>
        <ChevronDown className="h-3.5 w-3.5 text-stone-500 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-800 p-3">{children}</div>
    </details>
  );
}

function ToolButton({
  onClick,
  children,
  tone = "default",
  active,
  disabled,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "danger";
  active?: boolean;
  disabled?: boolean;
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
      disabled={disabled}
      aria-pressed={active}
      className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-bold transition disabled:pointer-events-none disabled:opacity-35 ${color}`}
    >
      {children}
    </button>
  );
}

function Notice({ level, children }: { level: "warn" | "info"; children: React.ReactNode }) {
  return (
    <li
      className={`flex gap-2 rounded-lg p-2.5 text-[11px] leading-snug ${
        level === "warn" ? "bg-amber-400/10 text-amber-200" : "bg-sky-400/10 text-sky-200"
      }`}
    >
      {level === "warn" ? <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> : <Info className="mt-px h-3.5 w-3.5 shrink-0" />}
      <span>{children}</span>
    </li>
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

function MirrorButtons({ actions }: { actions: BuilderActions }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <ToolButton onClick={() => actions.mirror("x")} title="Flip left for right">
        <FlipHorizontal2 className="h-3.5 w-3.5" /> Left ↔ right
      </ToolButton>
      <ToolButton onClick={() => actions.mirror("z")} title="Flip front for back">
        Front ↔ back
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

/** Cut the piece in two: across its length, or along it (a rip). */
function CutInTwo({ piece, actions }: { piece: ScenePiece; actions: BuilderActions }) {
  const stock = getStock(piece.stock);
  const [along, setAlong] = useState<"length" | "width">("length");
  const total = along === "length" ? piece.length : piece.width;
  const [at, setAt] = useState(total / 2);
  // A new piece, or switching direction, starts the cut in the middle.
  useEffect(() => setAt((along === "length" ? piece.length : piece.width) / 2), [piece.id, piece.length, piece.width, along]);
  if (!stock) return null;

  const rest = total - at - SAW_KERF;
  const smallest = along === "length" ? 1 : stock.minWidth;
  const valid = at >= smallest && rest >= smallest;
  const across = stock.kind === "lumber" ? "Crosscut" : "Across";
  const lengthwise = stock.kind === "lumber" ? "Rip" : "Lengthwise";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <ToolButton onClick={() => setAlong("length")} active={along === "length"} title="Cut across the length">
          {across}
        </ToolButton>
        <ToolButton onClick={() => setAlong("width")} active={along === "width"} title="Cut along the length, splitting the width">
          {lengthwise}
        </ToolButton>
      </div>
      <LengthField label="First part" hint={`of ${formatInches(total)}`} value={at} onCommit={setAt} />
      <p className="text-[11px] leading-snug text-stone-500">
        {valid ? (
          <>
            Makes {formatInches(at)} and {formatInches(rest)}. The saw takes {formatInches(SAW_KERF)}.
          </>
        ) : (
          <>Both parts must be at least {formatInches(smallest)}.</>
        )}
      </p>
      <ToolButton onClick={() => actions.split(piece.id, along, at)} disabled={!valid}>
        <Scissors className="h-3.5 w-3.5" /> Cut in two
      </ToolButton>
    </div>
  );
}

function PieceInspector({
  piece,
  scene,
  overlaps,
  actions,
}: {
  piece: ScenePiece;
  scene: Scene;
  overlaps: string[];
  actions: BuilderActions;
}) {
  const stock = getStock(piece.stock);
  if (!stock) return null;

  const low = pieceBounds(piece).min;
  const warnings = pieceWarnings(piece);
  const orientation = orientationOf(piece);
  const thicknesses = sameKindStocks(piece.stock);
  const group = piece.groupId ? scene.groups.find((g) => g.id === piece.groupId) : undefined;
  const overlapNames = overlaps
    .map((id) => scene.pieces.find((p) => p.id === id))
    .filter((p): p is ScenePiece => !!p)
    .map(pieceLabel);
  const rips = [
    { label: "Full", title: 'Full width, 3-1/2"', width: stock.width },
    { label: "Half", title: 'Ripped in half, 1-9/16" after the saw kerf', width: HALF_RIP_WIDTH },
    { label: '1-1/2"', title: 'Square, 1-1/2" × 1-1/2"', width: 1.5 },
  ];

  return (
    <div className="space-y-5">
      <div>
        <NameField
          label="Name"
          value={piece.name ?? ""}
          placeholder={pieceLabel({ ...piece, name: undefined })}
          onCommit={(name) => actions.renamePiece(piece.id, name)}
        />
        <p className="mt-1.5 text-[11px] text-stone-500">{stock.description}</p>
        {group && (
          <button
            type="button"
            onClick={() => actions.select(scene.pieces.filter((p) => p.groupId === group.id).map((p) => p.id))}
            className="mt-2 flex w-full items-center gap-2 rounded-lg bg-slate-800/70 px-2.5 py-2 text-left text-[11px] text-stone-300 transition hover:text-yellow-300"
          >
            <Group className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Part of <strong>{group.name}</strong>
            </span>
            <span className="shrink-0 font-bold">Select group</span>
          </button>
        )}
      </div>

      {(warnings.length > 0 || overlapNames.length > 0) && (
        <ul className="space-y-1.5">
          {overlapNames.length > 0 && (
            <Notice level="warn">
              Shares space with {overlapNames.length === 1 ? overlapNames[0] : `${overlapNames.length} other pieces`}. Two pieces
              can&apos;t be in the same place: move one, or shorten it to fit.
            </Notice>
          )}
          {warnings.map((w) => (
            <Notice key={w.text} level={w.level}>
              {w.text}
            </Notice>
          ))}
        </ul>
      )}

      {stock.kind === "hardware" ? (
        <p className="rounded-lg bg-slate-800/60 p-2.5 font-mono text-[11px] text-stone-300">
          {formatInches(piece.length)} × {formatInches(piece.width)} × {formatInches(piece.thickness)} tall
          <span className="mt-1 block font-sans text-stone-500">
            {stock.hardware?.placeholder ? "A stand-in for sizing. It isn't cut or fastened." : "Bought as is. It goes on the shopping list."}
          </span>
        </p>
      ) : (
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
                  title={r.title}
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
              <select value={piece.stock} onChange={(e) => actions.setStock(piece.id, e.target.value)} className={FIELD}>
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
      )}

      <section>
        <Heading>Position</Heading>
        <div className="grid grid-cols-3 gap-2">
          <LengthField compact label="Left" value={low[0]} onCommit={(v) => actions.setEdge(piece.id, "x", v)} />
          <LengthField compact label="Off floor" value={low[1]} onCommit={(v) => actions.setEdge(piece.id, "y", v)} />
          <LengthField compact label="Back" value={low[2]} onCommit={(v) => actions.setEdge(piece.id, "z", v)} />
        </div>
        <p className="mt-1.5 text-[10px] text-stone-600">Inches to the piece&apos;s left edge, underside and back edge.</p>
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
            suffix="°"
            onCommit={(y) => actions.setRotation(piece.id, [piece.rotation[0], y, piece.rotation[2]])}
          />
        </div>
      </section>

      <SelectionActions actions={actions} />

      {stock.kind !== "hardware" && (
        <Disclosure title="Cut in two" icon={<Scissors className="h-3.5 w-3.5" />}>
          <CutInTwo piece={piece} actions={actions} />
        </Disclosure>
      )}
      <Disclosure title="Mirror" icon={<FlipHorizontal2 className="h-3.5 w-3.5" />}>
        <MirrorButtons actions={actions} />
      </Disclosure>
    </div>
  );
}

// ── Several pieces ───────────────────────────────────────────────────────

const ALIGN_ROWS: { axis: Axis; label: string; modes: { mode: AlignMode; label: string }[] }[] = [
  { axis: "x", label: "Side to side", modes: [{ mode: "min", label: "Left" }, { mode: "center", label: "Center" }, { mode: "max", label: "Right" }] },
  { axis: "z", label: "Front to back", modes: [{ mode: "min", label: "Back" }, { mode: "center", label: "Center" }, { mode: "max", label: "Front" }] },
  { axis: "y", label: "Up and down", modes: [{ mode: "min", label: "Bottom" }, { mode: "center", label: "Middle" }, { mode: "max", label: "Top" }] },
];

/** Clear space between the two things selected, on each axis. */
function GapReadout({ pieces }: { pieces: ScenePiece[] }) {
  const units = new Map<string, ScenePiece[]>();
  for (const p of pieces) units.set(p.groupId ?? p.id, [...(units.get(p.groupId ?? p.id) ?? []), p]);
  if (units.size !== 2) return null;
  const [a, b] = [...units.values()];
  const gap = gapBetween(a, b);
  if (!gap) return null;
  const rows: [string, number][] = [
    ["Side to side", gap[0]],
    ["Up and down", gap[1]],
    ["Front to back", gap[2]],
  ];
  return (
    <section>
      <Heading>Space between them</Heading>
      <dl className="space-y-1.5 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-stone-500">{label}</dt>
            <dd className="text-right font-mono font-semibold text-stone-200">
              {value > 0.001 ? formatInches(value) : Math.abs(value) <= 0.001 ? "touching" : "side by side"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MultiInspector({
  scene,
  selected,
  info,
  overlapCount,
  actions,
}: {
  scene: Scene;
  selected: ScenePiece[];
  info: SelectionInfo;
  overlapCount: number;
  actions: BuilderActions;
}) {
  return (
    <div className="space-y-5">
      <div>
        {info.group ? (
          <NameField label="Group" value={info.group.name} onCommit={(name) => actions.renameGroup(info.group!.id, name)} />
        ) : (
          <p className="text-sm font-bold text-white">{info.count} pieces selected</p>
        )}
        {info.size && (
          <p className="mt-1.5 font-mono text-[11px] text-stone-400">
            {formatInches(info.size[0])} W × {formatInches(info.size[1])} H × {formatInches(info.size[2])} D
          </p>
        )}
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <ToolButton onClick={actions.group} disabled={!!info.group} title="Make these one group (Ctrl/⌘ G)">
            <Group className="h-3.5 w-3.5" /> Group
          </ToolButton>
          <ToolButton onClick={actions.ungroup} disabled={!info.hasGroup} title="Break the group apart (Ctrl/⌘ Shift G)">
            <Ungroup className="h-3.5 w-3.5" /> Ungroup
          </ToolButton>
        </div>
      </div>

      {overlapCount > 0 && (
        <ul>
          <Notice level="warn">
            {overlapCount} of these share space with another piece. Select one to see which.
          </Notice>
        </ul>
      )}

      {info.group && (
        <section>
          <Heading>In this group</Heading>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {selected.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => actions.select([p.id])}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-stone-300 transition hover:bg-slate-800 hover:text-yellow-300"
                >
                  <span className="truncate">{pieceLabel(p)}</span>
                  <span className="shrink-0 font-mono text-[10px] text-stone-500">{formatInches(p.length)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <GapReadout pieces={selected} />

      <section>
        <Heading>Turn together</Heading>
        <TurnButtons actions={actions} />
      </section>

      <SelectionActions actions={actions} />

      <Disclosure title="Align and space" icon={<Group className="h-3.5 w-3.5" />}>
        {info.unitCount < 2 ? (
          <p className="text-[11px] leading-snug text-stone-500">
            A group lines up as one thing. Select another piece or group as well to align them.
          </p>
        ) : (
          <div className="space-y-3">
            {ALIGN_ROWS.map((row) => (
              <div key={row.axis}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-500">{row.label}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {row.modes.map((m) => (
                    <ToolButton key={m.mode} onClick={() => actions.align(row.axis, m.mode)} title={`Line up ${m.label.toLowerCase()} edges`}>
                      {m.label}
                    </ToolButton>
                  ))}
                  <ToolButton
                    onClick={() => actions.distribute(row.axis)}
                    disabled={info.unitCount < 3}
                    title="Equal gaps between them (needs three or more)"
                  >
                    Space
                  </ToolButton>
                </div>
              </div>
            ))}
            <p className="text-[10px] leading-snug text-stone-600">
              Space makes the gaps equal; the two outer ones stay where they are.
            </p>
          </div>
        )}
      </Disclosure>
      <Disclosure title="Mirror" icon={<FlipHorizontal2 className="h-3.5 w-3.5" />}>
        <MirrorButtons actions={actions} />
      </Disclosure>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────

export default function BuilderInspector({
  scene,
  selected,
  info,
  overlapsOf,
  actions,
}: {
  scene: Scene;
  selected: ScenePiece[];
  info: SelectionInfo;
  /** For each overlapping piece, the pieces it overlaps */
  overlapsOf: Map<string, string[]>;
  actions: BuilderActions;
}) {
  if (selected.length === 1) {
    const piece = selected[0];
    // Remount per piece so the open sections and draft fields start fresh
    return <PieceInspector key={piece.id} piece={piece} scene={scene} overlaps={overlapsOf.get(piece.id) ?? []} actions={actions} />;
  }

  if (selected.length > 1) {
    return (
      <MultiInspector
        scene={scene}
        selected={selected}
        info={info}
        overlapCount={selected.filter((p) => overlapsOf.has(p.id)).length}
        actions={actions}
      />
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
                ["Groups", String(scene.groups.length)],
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
          {(s.warningCount > 0 || overlapsOf.size > 0) && (
            <ul className="space-y-1.5">
              {overlapsOf.size > 0 && (
                <Notice level="warn">
                  {overlapsOf.size} pieces share space with another piece (outlined in red).{" "}
                  <button type="button" className="font-bold underline" onClick={() => actions.select([...overlapsOf.keys()])}>
                    Select them
                  </button>
                </Notice>
              )}
              {s.warningCount > 0 && (
                <Notice level="warn">
                  {s.warningCount} piece{s.warningCount === 1 ? "" : "s"} can&apos;t be bought or cut as drawn. Select a piece to see why.
                </Notice>
              )}
            </ul>
          )}
          <p className="text-[11px] leading-snug text-stone-500">
            Select a piece to set its exact size and position. Shift-click to select several.
          </p>
        </>
      )}
    </div>
  );
}
