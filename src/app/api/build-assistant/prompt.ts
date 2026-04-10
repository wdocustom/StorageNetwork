// ═══════════════════════════════════════════════════════════════════════════
// BUILD ASSISTANT — System Prompt
// Product knowledge, pricing defaults, and behavioral instructions.
// Dynamic build context is injected at runtime.
// ═══════════════════════════════════════════════════════════════════════════

import { BESTSELLER_PRESETS } from "@/lib/presets";

const PRODUCT_KNOWLEDGE = `
## Product Line

### Standard Tote Organizers (27-gallon)
- Heavy-duty 2x4 lumber frame with 3/4" plywood rails
- HDX totes (19-3/4" opening) — Home Depot, Menards
- GreenMade/Wide totes (20-3/4" opening) — Costco, Lowe's, Walmart
- Standard orientation: 30" deep, 16" vertical spacing between tiers
- Sideways orientation: 20" deep, 30.25" slot width (totes rotated 90 degrees)
- Max 4 columns per width module (auto-splits wider units)
- Max 6 rows per height tier (auto-splits taller units to fit 8ft lumber)
- Plywood top: 1 sheet up to 96" wide, 2 sheets up to 192", 3 sheets above 192"

### Mini Tote Organizers (6.5-quart)
- Same 2x4 frame construction, smaller scale
- 8.25" slot width, 7" vertical spacing, 12.75" deep
- Max 4 tiers, max 96" wide
- Plywood top is mandatory (structural)

### 2x4 Rail Construction Mode
- Alternative build method using ripped 2x4 lumber rails instead of plywood strips
- Universal 21" openings (tote type is irrelevant — no totes included)
- Rails are ripped 2x4s: 1.5" wide × 1.75" tall, same orientation as posts (narrow face)
- Fixed rail heights from bottom of vertical posts: 13-3/4", 29-1/2", 45-1/4", 61", 76-3/4"
- Max 5 rows (each row corresponds to a fixed rail position)
- 6 rail pieces per 2x4x8' board (ripped in half lengthwise → 2 strips × 3 cuts at 30" depth)
- Frame height = 1.5" bottom plate + post height + 1.5" top plate (4 plates total: top/bottom × front/back)
- Post height = top rail position + 2.75" top gap
- Example: 4×2 unit = 91.5" wide × 35.25" tall (posts = 32.25", + 3" for plates)
- Rails use 3" screws (not 1-5/8" plywood screws) — 4 screws per rail piece
- No plywood strip stock needed (only sheets for optional plywood top)
- Enabled per-installer via pricing settings toggle

### Raised Planter Boxes
- Custom cedar or lumber planter boxes — any dimension
- Common sizes: 36"×24", 48"×24", 48"×48", 72"×24"
- Options: bottom shelf, raised legs, liners, casters/wheels
- Typical pricing: $200–$500 depending on size and features
- Added to quotes as custom line items via the AI Builder
- Example: "36×24 raised planter box with shelf" = ~$350

### Custom Line Items
- Installers can add ANY custom product or service to quotes via the AI Builder
- Examples: garage cleanout, custom shelf builds, workbenches, tool stations
- Each custom item has a description and a price
- Custom items appear in the quote alongside tote organizer units

### Add-ons (Organizer Customization)
- Plywood doors (per-bay or all bays), side panels, shelves, rail removal
- Concealed hinges (Blum pairs) included with doors
- Paint: frame, doors, panels — per-unit options

### Open Shelving
- Custom heavy-duty shelves: 4ft, 5ft, 6ft widths; short or tall heights
- Not mixable with tote organizers in the same quote

### Overhead Ceiling Storage
- Ceiling-mounted tote rail system lagged to joists
- 2x2 through 4x4 grid configurations
- CAN be mixed with tote organizers

## Screw Sizes & Usage
- **1" screws**: Wheel mounting (16 per wheel kit)
- **1-5/8" screws**: Plywood rail attachment (4 per rail)
- **3" screws**: Structural frame assembly — uprights to plates (20 per post pair)

## Material Counts (Standard Units)
- **2x4 Lumber**: Uprights (posts) + top/bottom plates + depth braces. (cols+1)*2 posts per module per tier, 4 rail plates per module per tier
- **Plywood strips**: 2 rails per slot + back supports (4 for ≤4 cols, 6 for >4 cols) per module
- **Plywood sheets**: For plywood top + rails (cut from same stock)
- **Totes**: 1 per slot when included
- **Wheel kits**: 1 per unit (4 casters each)

## Pricing Defaults (platform standard — installers can override)
- Standard slot: $30/slot
- Mini slot: $15/slot
- Standard tote (black): $12, Clear HDX tote: $20
- Mini tote: $4
- Standard wheels: $65, Mini wheels: $40
- Plywood top: $95/sheet

## Fee Structure
- Network leads (customer found via platform): 15% platform fee
- Direct leads (installer's own link): 3% maintenance fee
- Minimum customer deposit: 15% of job total
- Installer's profit = Job Price - Platform Fee - Material Cost
`;

function formatPresets(): string {
  return BESTSELLER_PRESETS.map((p) => {
    const subUnits = p.units
      .map(
        (u) =>
          `${u.cols}x${u.rows}${u.hasTop ? " +top" : ""}${u.hasWheels ? " +wheels" : ""}`
      )
      .join(" + ");
    return `- **${p.name}** (${p.id}): ${subUnits} | ${p.toteModel} ${p.toteColor} | ${p.unitType} ${p.orientation}`;
  }).join("\n");
}

interface BuildContext {
  buildResult?: {
    cols: number;
    rows: number;
    price: number;
    totalW: number;
    totalH: number;
    depth: number;
    slots: number;
    unitType: string;
    orientation: string;
  } | null;
  units?: Array<{
    cols: number;
    rows: number;
    toteType: string;
    unitType: string;
    hasTotes: boolean;
    hasWheels: boolean;
    hasTop: boolean;
    price: number;
    desc?: string;
  }>;
  materialBreakdown?: {
    totalCost: number;
    items: Array<{ name: string; qty: number; unitCost: number; subtotal: number }>;
    rawCounts: Record<string, number>;
  } | null;
  feeBreakdown?: {
    networkFeePercent: string;
    networkFeeAmount: number;
    networkCollect: number;
    networkNetProfit: number;
    directFeePercent: string;
    directFeeAmount: number;
    directCollect: number;
    directNetProfit: number;
    depositAmount: number;
    depositLabel: string;
  } | null;
  manifest?: {
    totals: {
      boards: number;
      sheets: number;
      totes: number;
      wheelKits: number;
      screwBoxes_1_5_8: number;
      screwBoxes_3: number;
      screwBoxes_1: number;
    };
    shopping_list: Array<{ name: string; detail: string; qty: number | string }>;
  } | null;
  installerPricing?: Record<string, unknown> | null;
  materialPrices?: Record<string, number> | null;
}

function formatBuildContext(ctx: BuildContext): string {
  const parts: string[] = [];

  if (ctx.buildResult) {
    const b = ctx.buildResult;
    parts.push(`## Current Build
- Config: ${b.cols}W x ${b.rows}H ${b.unitType} (${b.orientation})
- Price: $${b.price}
- Dimensions: ${b.totalW}" W x ${b.totalH}" H x ${b.depth}" D
- Slots: ${b.slots}`);
  }

  if (ctx.units && ctx.units.length > 0) {
    const lines = ctx.units.map(
      (u, i) =>
        `  ${i + 1}. ${u.desc || `${u.cols}x${u.rows}`} ${u.unitType} ${u.toteType} — $${u.price}${u.hasTotes ? " +totes" : ""}${u.hasWheels ? " +wheels" : ""}${u.hasTop ? " +top" : ""}`
    );
    parts.push(`## Quote Builder (${ctx.units.length} units)\n${lines.join("\n")}`);
  }

  if (ctx.manifest?.totals) {
    const t = ctx.manifest.totals;
    parts.push(`## Materials Summary
- 2x4 Boards: ${t.boards}
- Plywood Sheets: ${t.sheets}
- Totes: ${t.totes}
- Wheel Kits: ${t.wheelKits}
- 1-5/8" Screw Boxes: ${t.screwBoxes_1_5_8}
- 3" Screw Boxes: ${t.screwBoxes_3}
- 1" Screw Boxes: ${t.screwBoxes_1}`);
  }

  if (ctx.manifest?.shopping_list) {
    const items = ctx.manifest.shopping_list
      .map((s) => `  - ${s.qty}x ${s.name} — ${s.detail}`)
      .join("\n");
    parts.push(`## Shopping List\n${items}`);
  }

  if (ctx.materialBreakdown) {
    const m = ctx.materialBreakdown;
    const items = m.items.map((i) => `  - ${i.name}: ${i.qty} x $${i.unitCost.toFixed(2)} = $${i.subtotal.toFixed(2)}`).join("\n");
    parts.push(`## Material Costs (Total: $${m.totalCost.toFixed(2)})\n${items}`);
  }

  if (ctx.feeBreakdown) {
    const f = ctx.feeBreakdown;
    parts.push(`## Profit Breakdown
- Network Lead: $${f.networkCollect} collect → $${f.networkNetProfit} profit (after ${f.networkFeePercent} fee)
- Direct Lead: $${f.directCollect} collect → $${f.directNetProfit} profit (after ${f.directFeePercent} fee)
- Customer Deposit: $${f.depositAmount} (${f.depositLabel})`);
  }

  if (ctx.installerPricing && Object.keys(ctx.installerPricing).length > 0) {
    const use2x4 = (ctx.installerPricing as Record<string, unknown>).use_2x4_rails === true;
    parts.push(`## Custom Pricing Active
The installer has custom pricing overrides configured. Calculations already use these rates.${use2x4 ? "\n**2x4 Rail Construction Mode is ENABLED.** All tote rack builds use ripped 2x4 rails instead of plywood strips. Universal 21\" openings, max 5 rows, no totes. Rail boards are counted separately from structural boards." : ""}`);
  }

  return parts.length > 0 ? parts.join("\n\n") : "No build configured yet.";
}

export function buildSystemPrompt(context: BuildContext): string {
  return `You are the Build Assistant for Storage Network — an expert advisor for professional storage system installers.

## Your Role
Help installers with questions about builds, materials, pricing, and profitability. You are given real calculated data — use it, never guess.

## Behavioral Rules
- Be concise and direct — installers are busy professionals
- Use the build context and calculation results provided — they are accurate
- Format dollar amounts with $ signs, round to 2 decimal places
- Use markdown: bold for emphasis, tables for comparisons, bullet lists for breakdowns
- When asked about screws, give EXACT counts AND sizes with their purpose
- When asked about profit, show BOTH network and direct lead scenarios
- Keep responses focused — don't dump every data point unless asked

${PRODUCT_KNOWLEDGE}

## Bestseller Presets
${formatPresets()}

## Installer's Current State
${formatBuildContext(context)}
`;
}
