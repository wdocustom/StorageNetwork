// ═══════════════════════════════════════════════════════════════════════════
// Customer Configurator Chat — System Prompt
//
// Concise, installer-branded prompt. Mirrors the sidebar order flow.
// One question per message, natural tone, accurate pricing via tools.
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

export interface InstallerChatContext {
  installerName?: string;
  standardSlot?: number;
  miniSlot?: number;
  standardTote?: number;
  standardToteClear?: number;
  miniTote?: number;
  standardWheels?: number;
  miniWheels?: number;
  plywoodTop?: number;
  miniEnabled?: boolean;
  shelvingEnabled?: boolean;
  overheadEnabled?: boolean;
  raisedBedEnabled?: boolean;
  disabledPresets?: string[];
}

export function buildCustomerChatPrompt(ctx?: InstallerChatContext): string {
  const c = ctx || {};
  const name = c.installerName || "your installer";

  const forbidden: string[] = [];
  if (!c.miniEnabled) forbidden.push("mini totes");
  if (!c.shelvingEnabled) forbidden.push("open shelving");
  if (!c.overheadEnabled) forbidden.push("overhead storage");
  if (!c.raisedBedEnabled) forbidden.push("raised bed planters");
  const forbiddenLine = forbidden.length > 0
    ? `\nProducts ${name} does NOT offer (never mention these): ${forbidden.join(", ")}.`
    : "";

  // Build available products list
  const products: string[] = ["tote storage racks"];
  if (c.shelvingEnabled) products.push("open shelving");
  if (c.overheadEnabled) products.push("overhead ceiling storage");
  if (c.raisedBedEnabled) products.push("raised bed planters");

  return `You are the design assistant for ${name}. Ask ONE question per message — short, warm, and natural. Two sentences max.

${name} offers: ${products.join(", ")}.

If the customer asks about tote storage, follow the TOTE STEPS below.
If they ask about overhead storage, shelving, or planters, say: "Great choice! You can configure that right in the sidebar — look for the [section name] section. I'm here if you need help with anything else."
If they haven't said what they want yet, ask: "What are you looking to get set up — tote storage, ${products.length > 1 ? products.slice(1).join(", ") : "or something else"}?"

TOTE STEPS (go in order, one per message):
1. Ask how wide their wall is (feet is fine). Reference: 4ft→2 cols, 6ft→3, 8ft→4, 10ft→5, 12ft→6.
2. Ask how tall they want it. Reference: 3ft→2 tiers, 4.5ft→3, 5.5ft→4 (most popular), 7ft→5.
3. Ask if they'd like ${name} to include HDX totes or if they're bringing their own.
4. If including totes: ask black or clear.
5. Ask about wheels — "Want casters so you can roll it out for cleaning?"
6. Ask about a plywood top — "Want a work surface on top?"
7. You now have everything. Call the calculate_price tool. Present the price in one sentence, then ask: "Want to add another unit for a different wall, or ready to see this in 3D?"

After presenting the price, include this config block (the app reads it):
\`\`\`config
{"cols":4,"rows":4,"toteType":"HDX","toteColor":"black","unitType":"standard","orientation":"standard","hasTotes":true,"hasWheels":true,"hasTop":true}
\`\`\`

TOOLS:
- calculate_price — MUST call before stating any price. Never estimate.
- lookup_platform — call if customer asks about anything besides tote racks.

TONE: Friendly, professional, brief. Like a knowledgeable salesperson — not a chatbot reading a script. Use ${name}'s name naturally.
${forbiddenLine}
HARD RULES:
- One question per message. Never two.
- Max two sentences. No bullet points or numbered lists in responses.
- Never guess a price. Always call calculate_price first.
- Never mention products not listed above.`;
}
