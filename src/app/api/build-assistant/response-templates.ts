// ═══════════════════════════════════════════════════════════════════════════
// Build Assistant — Response Templates
//
// Deterministic markdown formatters for each calculation result type.
// Replaces AI-generated responses (Step 3) with consistent, instant output.
// ═══════════════════════════════════════════════════════════════════════════

import { BESTSELLER_PRESETS } from "@/lib/presets";

type CalcResult = Record<string, unknown>;

function $(n: unknown): string {
  const num = Number(n);
  if (isNaN(num)) return "$0";
  return num >= 1000
    ? `$${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function $whole(n: unknown): string {
  const num = Number(n);
  if (isNaN(num)) return "$0";
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function addOns(r: CalcResult): string {
  const parts: string[] = [];
  if (r.hasTotes) parts.push("Totes");
  if (r.hasWheels) parts.push("Wheels");
  if (r.hasTop) parts.push("Plywood Top");
  return parts.length > 0 ? parts.join(", ") : "Frame Only";
}

// ── Individual formatters ─────────────────────────────────────────────────

function formatBuild(r: CalcResult): string {
  if (r.error) return `**Build Error:** ${r.error}`;

  const dims = r.dimensions as Record<string, number> | undefined;
  const mode = r.mode === "wallFit" ? " (wall-fit)" : "";
  const lines = [
    `**${r.cols}W × ${r.rows}H Standard Unit${mode}**`,
    "",
    `| | |`,
    `|---|---|`,
    `| **Price** | ${$whole(r.price)} |`,
    `| **Slots** | ${r.slots} |`,
  ];
  if (dims) {
    lines.push(`| **Width** | ${dims.totalW}" |`);
    lines.push(`| **Height** | ${dims.totalH}" |`);
    lines.push(`| **Depth** | ${dims.depth}" |`);
  }
  lines.push(`| **Add-ons** | ${addOns(r)} |`);
  return lines.join("\n");
}

function formatPreset(r: CalcResult): string {
  const subs = r.subUnits as Array<{ config: string; price: number; slots: number }> | undefined;
  const lines = [
    `**${r.presetName}** — ${$whole(r.totalPrice)} (${r.totalSlots} slots)`,
    "",
  ];

  if (subs && subs.length > 1) {
    lines.push(`| Unit | Config | Price | Slots |`);
    lines.push(`|------|--------|-------|-------|`);
    subs.forEach((s, i) => {
      lines.push(`| ${i + 1} | ${s.config} | ${$whole(s.price)} | ${s.slots} |`);
    });
    lines.push("");
  }

  lines.push(`**Footprint:** ${r.combinedWidth}" W × ${r.maxHeight}" H × ${r.depth}" D`);
  return lines.join("\n");
}

function formatManifest(r: CalcResult): string {
  const totals = r.totals as Record<string, number> | undefined;
  const shoppingList = r.shopping_list as Array<{ name: string; detail: string; qty: number | string }> | undefined;
  const financials = r.financials as Record<string, number> | undefined;

  const lines = [`**Shopping List — ${r.config} Unit**`, ""];

  if (shoppingList && shoppingList.length > 0) {
    lines.push(`| Item | Qty | Details |`);
    lines.push(`|------|-----|---------|`);
    for (const item of shoppingList) {
      lines.push(`| ${item.name} | ${item.qty} | ${item.detail} |`);
    }
    lines.push("");
  }

  if (totals) {
    const summary: string[] = [];
    if (totals.boards) summary.push(`${totals.boards} boards`);
    if (totals.sheets) summary.push(`${totals.sheets} plywood sheets`);
    if (totals.totes) summary.push(`${totals.totes} totes`);
    if (totals.wheelKits) summary.push(`${totals.wheelKits} wheel kit`);
    if (totals.screwBoxes_3) summary.push(`${totals.screwBoxes_3} box 3" screws`);
    if (totals.screwBoxes_1_5_8) summary.push(`${totals.screwBoxes_1_5_8} box 1-5/8" screws`);
    if (totals.screwBoxes_1) summary.push(`${totals.screwBoxes_1} box 1" screws`);
    if (summary.length > 0) {
      lines.push(`**Totals:** ${summary.join(", ")}`);
    }
  }

  if (financials) {
    lines.push("");
    lines.push(`| | |`);
    lines.push(`|---|---|`);
    lines.push(`| **Retail Total** | ${$(financials.retailTotal)} |`);
    lines.push(`| **Deposit (${financials.depositRate}%)** | ${$(financials.depositAmount)} |`);
    lines.push(`| **Balance Due** | ${$(financials.balanceDue)} |`);
  }

  return lines.join("\n");
}

function formatMaterials(r: CalcResult): string {
  const items = r.items as Array<{ name: string; qty: number; unitCost: number; subtotal: number }> | undefined;

  const lines = [`**Material Costs — ${r.config} Unit**`, ""];

  if (items && items.length > 0) {
    lines.push(`| Material | Qty | Unit Cost | Subtotal |`);
    lines.push(`|----------|-----|-----------|----------|`);
    for (const item of items) {
      lines.push(`| ${item.name} | ${item.qty} | ${$(item.unitCost)} | ${$(item.subtotal)} |`);
    }
    lines.push("");
  }

  lines.push(`**Total Materials Cost: ${$(r.totalCost)}**`);
  return lines.join("\n");
}

function formatProfit(r: CalcResult): string {
  const lines = [
    `**Profit Breakdown**`,
    "",
    `| Scenario | Fee | You Collect | Net Profit |`,
    `|----------|-----|-------------|------------|`,
    `| Network Lead | ${r.networkFeePercent} (${$(r.networkFeeAmount)}) | ${$(r.networkCollect)} | **${$(r.networkNetProfit)}** |`,
    `| Direct Lead | ${r.directFeePercent} (${$(r.directFeeAmount)}) | ${$(r.directCollect)} | **${$(r.directNetProfit)}** |`,
    "",
    `**Customer Deposit:** ${$(r.depositAmount)} (${r.depositLabel})`,
  ];
  return lines.join("\n");
}

function formatOverhead(r: CalcResult): string {
  if (r.error) return `**Overhead Error:** ${r.error}`;

  const materials = r.materials as Array<{ name: string; qty: number; unit?: string }> | undefined;
  const totalPrice = Number(r.price || 0) + Number(r.totePrice || 0);

  const lines = [
    `**Overhead Ceiling Storage — ${r.gridPreset} Grid**`,
    "",
    `| | |`,
    `|---|---|`,
    `| **Price** | ${$whole(totalPrice)}${r.hasTotes ? ` (includes ${$(r.totePrice)} for totes)` : ""} |`,
    `| **Layout** | ${r.slotsWide} wide × ${r.slotsDeep} deep (${r.toteCount} totes) |`,
    `| **Footprint** | ${r.systemWidth}" W × ${r.systemDepth}" D |`,
  ];

  if (materials && materials.length > 0) {
    lines.push("", `**Materials:**`);
    lines.push(`| Item | Qty |`);
    lines.push(`|------|-----|`);
    for (const m of materials) {
      lines.push(`| ${m.name} | ${m.qty}${m.unit ? ` ${m.unit}` : ""} |`);
    }
  }

  return lines.join("\n");
}

function formatCustomItem(r: CalcResult): string {
  return [
    `**Custom Item**`,
    `- **Description:** ${r.description}`,
    `- **Price:** ${$whole(r.price)}`,
  ].join("\n");
}

function formatListPresets(): string {
  const lines = [`**Available Presets**`, ""];
  for (const p of BESTSELLER_PRESETS) {
    const config = p.units.map((u) => `${u.cols}×${u.rows}`).join(" + ");
    const opts: string[] = [];
    if (p.units.some((u) => u.hasWheels)) opts.push("wheels");
    if (p.units.some((u) => u.hasTop)) opts.push("top");
    if (p.totesDisabled) opts.push("no totes");
    if (p.totesAreMandatory) opts.push("totes mandatory");
    const totalSlots = p.units.reduce((sum, u) => sum + u.cols * u.rows, 0);
    lines.push(`- **${p.name}** (${p.id}): ${config}${opts.length ? ` — ${opts.join(", ")}` : ""} | ${totalSlots} slots`);
  }
  return lines.join("\n");
}

// ── Result dispatcher ─────────────────────────────────────────────────────

function formatSingleResult(r: CalcResult): string {
  switch (r.type) {
    case "build": return formatBuild(r);
    case "preset": return formatPreset(r);
    case "manifest": return formatManifest(r);
    case "materials": return formatMaterials(r);
    case "profit": return formatProfit(r);
    case "overhead": return formatOverhead(r);
    case "custom_item": return formatCustomItem(r);
    case "list_presets": return formatListPresets();
    default: return `**${r.type}:** ${JSON.stringify(r, null, 2)}`;
  }
}

export function formatAssistantResponse(results: CalcResult[]): string {
  if (results.length === 0) return "";
  if (results.length === 1) return formatSingleResult(results[0]);

  return results.map(formatSingleResult).join("\n\n---\n\n");
}
