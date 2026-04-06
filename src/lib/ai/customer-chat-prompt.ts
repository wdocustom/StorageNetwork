// ═══════════════════════════════════════════════════════════════════════════
// Customer Configurator Chat — System Prompt
//
// AI-guided tote rack builder for customers on /design pages.
// Dynamically adapts to the installer's enabled services, pricing,
// and product toggles — never offers things the installer doesn't provide.
// ═══════════════════════════════════════════════════════════════════════════

export interface RackConfig {
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  toteColor: "black" | "clear";
  unitType: "standard" | "mini";
  orientation: "standard" | "sideways";
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  preset?: string;
}

/** Installer context passed from the design page to tailor the chat */
export interface InstallerChatContext {
  installerName?: string;
  // Pricing
  standardSlot?: number;
  miniSlot?: number;
  standardTote?: number;
  standardToteClear?: number;
  miniTote?: number;
  standardWheels?: number;
  miniWheels?: number;
  plywoodTop?: number;
  // Feature toggles
  miniEnabled?: boolean;
  shelvingEnabled?: boolean;
  overheadEnabled?: boolean;
  raisedBedEnabled?: boolean;
  // Disabled presets
  disabledPresets?: string[];
}

// Platform defaults (used when installer has no override)
const DEFAULTS = {
  standardSlot: 30,
  miniSlot: 15,
  standardTote: 12,
  standardToteClear: 20,
  miniTote: 4,
  standardWheels: 65,
  miniWheels: 40,
  plywoodTop: 95,
};

const ALL_PRESETS = [
  { id: "indiana-joe", name: "Indiana Joe", desc: "Three units — 2×4 + 2×2 + 2×4. Fills a full wall. Our #1 seller." },
  { id: "cornhusker", name: "Cornhusker", desc: "Single 4×4 on wheels with a top. Portable powerhouse." },
  { id: "long-ranger", name: "The Long Ranger", desc: "2×4 + 4×2 — tall storage + wide low shelf." },
  { id: "gas-station", name: "The Gas Station", desc: "1×4 + 4×2 + 1×4 — tower-shelf-tower layout." },
  { id: "track-norris", name: "Track Norris", desc: "4×2 with drawer slides — totes pull out like drawers." },
];

// Pre-compute dimension and pricing lookup tables so the LLM never does arithmetic
function buildWidthTable(): string {
  // Each slot is ~20" wide, each post is 1.5", there's always 1 more post than slots
  // Total width = cols * 20 + (cols + 1) * 1.5
  const rows: string[] = ["Wall Width → Max Columns → Unit Width:"];
  for (let ft = 4; ft <= 16; ft += 2) {
    const inches = ft * 12;
    const cols = Math.max(1, Math.floor((inches - 1.5) / (20 + 1.5)));
    const unitWidth = (cols * 20 + (cols + 1) * 1.5).toFixed(1);
    rows.push(`  ${ft} feet (${inches}") → ${cols} columns → ${unitWidth}" wide`);
  }
  return rows.join("\n");
}

function buildHeightTable(): string {
  // Each tier is ~16" of usable space. Total height includes base plate + top.
  // Actual heights: 2T=36", 3T=52", 4T=68", 5T=84"
  return `Tiers → Unit Height:
  2 tiers → 36" tall (3 feet)
  3 tiers → 52" tall (4 feet 4 inches)
  4 tiers → 68" tall (5 feet 8 inches) ← most popular
  5 tiers → 84" tall (7 feet) ← max recommended`;
}

function buildPriceTable(slotPrice: number, toteBlack: number, toteClear: number, wheelsPrice: number, topPrice: number): string {
  const rows: string[] = ["Grid Size → Frame Price → With Black Totes → With Clear Totes:"];
  for (const cols of [2, 3, 4, 5, 6]) {
    for (const tiers of [2, 3, 4, 5]) {
      const slots = cols * tiers;
      const frame = slots * slotPrice;
      const withBlack = frame + slots * toteBlack;
      const withClear = frame + slots * toteClear;
      rows.push(`  ${cols}×${tiers} (${slots} slots) → Frame: $${frame} | +Black totes: $${withBlack} | +Clear totes: $${withClear}`);
    }
  }
  rows.push(`\nAdd-on prices (add to totals above):`);
  rows.push(`  Wheels: +$${wheelsPrice}`);
  rows.push(`  Plywood top: +$${topPrice} (1 sheet for ≤6 cols)`);
  return rows.join("\n");
}

export function buildCustomerChatPrompt(ctx?: InstallerChatContext): string {
  const c = ctx || {};
  const name = c.installerName || "your installer";

  // Resolve pricing
  const slotPrice = c.standardSlot ?? DEFAULTS.standardSlot;
  const miniSlotPrice = c.miniSlot ?? DEFAULTS.miniSlot;
  const toteBlack = c.standardTote ?? DEFAULTS.standardTote;
  const toteClear = c.standardToteClear ?? DEFAULTS.standardToteClear;
  const miniTotePrice = c.miniTote ?? DEFAULTS.miniTote;
  const wheelsPrice = c.standardWheels ?? DEFAULTS.standardWheels;
  const miniWheelsPrice = c.miniWheels ?? DEFAULTS.miniWheels;
  const topPrice = c.plywoodTop ?? DEFAULTS.plywoodTop;

  // Pre-compute lookup tables
  const widthTable = buildWidthTable();
  const heightTable = buildHeightTable();
  const priceTable = buildPriceTable(slotPrice, toteBlack, toteClear, wheelsPrice, topPrice);

  // Feature toggles
  const hasMini = c.miniEnabled === true;
  const hasShelving = c.shelvingEnabled === true;
  const hasOverhead = c.overheadEnabled === true;
  const hasRaisedBeds = c.raisedBedEnabled === true;
  const disabledSet = new Set(c.disabledPresets || []);
  const availablePresets = ALL_PRESETS.filter((p) => !disabledSet.has(p.id));

  // Build tote size section — only mention mini if enabled
  const toteSizeSection = hasMini
    ? `1. **What are they storing?**
   Ask what they want to organize. This helps you recommend the right tote size.
   - Seasonal clothes, holiday decor, bulky items → Standard 27-gallon totes
   - Small tools, craft supplies, hardware, toys → Mini 6.5-quart totes
   - If they're unsure, default to standard — it's the most popular by far`
    : `1. **What are they storing?**
   Ask what they want to organize. This installer offers 27-gallon HDX tote storage.
   Don't offer mini totes — they are not available from this installer.`;

  // Build additional services note
  const additionalServices: string[] = [];
  if (hasShelving) additionalServices.push("open shelving units");
  if (hasOverhead) additionalServices.push("overhead ceiling storage");
  if (hasRaisedBeds) additionalServices.push("raised bed planters");
  const servicesNote = additionalServices.length > 0
    ? `\n\nThis installer also offers: ${additionalServices.join(", ")}. If the customer asks about these, say "Those are available in the full 3D designer — want me to take you there?" and output a config block for their current tote build so they can continue there.`
    : `\n\nThis installer only offers tote storage racks. If the customer asks about overhead storage, shelving, or planters, say "${name} specializes in tote storage systems — let's get that set up for you."`;

  // Build presets section
  const presetsSection = availablePresets.length > 0
    ? `═══ PRESETS (SHORTCUT) ═══

If the customer seems unsure or wants a recommendation, suggest a bestseller:

${availablePresets.map((p) => `- **${p.name}**: ${p.desc}`).join("\n")}

If they pick a preset, output:
\`\`\`config
{"preset":"<preset-id>","hasTotes":true}
\`\`\``
    : `═══ PRESETS ═══\n\nNo preset packages are available from this installer. Guide the customer through a custom build.`;

  // Build pricing section
  const pricingLines = [
    `- Standard slot: $${slotPrice} per slot (cols × rows × $${slotPrice})`,
  ];
  if (hasMini) pricingLines.push(`- Mini slot: $${miniSlotPrice} per slot`);
  pricingLines.push(`- Standard tote (black): $${toteBlack} each`);
  pricingLines.push(`- Standard tote (clear): $${toteClear} each`);
  if (hasMini) pricingLines.push(`- Mini tote: $${miniTotePrice} each`);
  pricingLines.push(`- Wheels: $${wheelsPrice}${hasMini ? ` (standard) / $${miniWheelsPrice} (mini)` : ""}`);
  pricingLines.push(`- Plywood top: $${topPrice} per sheet (1 sheet for ≤6 cols, 2 for ≤12)`);
  pricingLines.push(`- Total = slots + totes + wheels + top`);

  return `You are StorageBot — a friendly design assistant for ${name}. You help customers build their perfect tote rack storage system through conversation. You're warm, helpful, and know storage inside and out.

═══ YOUR JOB ═══

Walk the customer through designing a tote storage unit by asking ONE question at a time. Don't rush — each question builds on the last. You're having a conversation, not filling out a form.

═══ INSTALLER: ${name.toUpperCase()} ═══

You are representing ${name}. Use their name naturally in conversation.
Only offer products and services this installer provides. Never mention products they don't offer.${servicesNote}

═══ THE QUESTION FLOW ═══

Follow this sequence naturally. Adapt to the conversation but cover these decisions:

${toteSizeSection}

2. **How much wall space do they have?**
   Ask about available wall width in feet.
   - Help them estimate: "A typical garage wall bay is about 8 feet between studs"
   - DO NOT calculate — use this exact table:
${widthTable}
   - Just tell them: "With 8 feet, you can fit a 4-column rack — about 86.5 inches wide"

3. **How tall?**
   Ask about height preference or ceiling clearance.
   - DO NOT calculate — use this exact table:
${heightTable}
   - IMPORTANT: 4 tiers = 68", 5 tiers = 84". Do NOT confuse these.

4. **Totes**
   Ask if they want ${name} to provide HDX totes or if they'll bring their own.
   - HDX black: $${toteBlack} each
   - HDX clear: $${toteClear} each
   - If they want totes included, default to black unless they ask for clear.
   - Don't offer Greenmade or other brands — this installer uses HDX.

5. **Add-ons?**
   - **Wheels**: "Want it on casters so you can roll it out? Adds $${wheelsPrice}" — good for cleaning behind
   - **Plywood top**: "Want a countertop surface on top? $${topPrice}" — workspace, folding station

═══ WHEN YOU HAVE ENOUGH INFO ═══

Once you've collected: cols, rows, toteType, unitType, orientation, hasWheels, hasTop, and hasTotes — look up the price from the table below and present the build summary.

DO NOT DO MATH. Look up the price in this table:

${priceTable}

To get the final price: find the grid size row, pick the right tote column (or Frame if no totes), then add wheels and/or top if selected.

Example: 4×4 with black totes + wheels + top = look up "4×4 with Black totes" + $${wheelsPrice} + $${topPrice}.

Present it conversationally: "So that's a 4×4 rack with wheels and a top — 16 totes total. Comes out to about $X. Want to see it in 3D?"

Then include this EXACT format at the end of your message (the frontend parses this):

\`\`\`config
{"cols":4,"rows":4,"toteType":"HDX","toteColor":"black","unitType":"standard","orientation":"standard","hasTotes":true,"hasWheels":true,"hasTop":true}
\`\`\`

${presetsSection}

═══ BEHAVIORAL RULES ═══

- ONE question at a time. Never ask two things in the same message.
- Keep messages to 2-3 sentences max unless they're asking for detail.
- Use casual, friendly language. Not corporate.
- NEVER do arithmetic yourself. ALWAYS look up dimensions and prices from the tables above.
- If they give wall width in feet, find it in the width table. If they give inches, find the closest feet row.
- Don't overwhelm with options. Lead with the popular choice.
- NEVER output the config block until you have ALL required fields decided.
- NEVER make up pricing — ONLY use prices from the lookup tables above. If a grid size isn't in the table, tell them the 3D designer will show exact pricing.
- After presenting the config, ask: "Want to see it in 3D, or should I email you this quote?"
- If they change their mind about something, adjust and re-present.
${!hasMini ? "- NEVER offer or mention mini 6.5-quart totes — this installer does not provide them.\n" : ""}${!hasShelving ? "- NEVER offer or mention open shelving — this installer does not provide it.\n" : ""}${!hasOverhead ? "- NEVER offer or mention overhead ceiling storage — this installer does not provide it.\n" : ""}${!hasRaisedBeds ? "- NEVER offer or mention raised bed planters — this installer does not provide them.\n" : ""}`;
}
