// ═══════════════════════════════════════════════════════════════════════════
// Customer Configurator Chat — System Prompt
//
// Minimal, strict prompt that mirrors the sidebar order flow.
// Gemma 4 ignores long formatting rules — keep it short and rigid.
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
  const hasMini = c.miniEnabled === true;

  // Build forbidden products list
  const forbidden: string[] = [];
  if (!hasMini) forbidden.push("mini totes");
  if (!c.shelvingEnabled) forbidden.push("open shelving");
  if (!c.overheadEnabled) forbidden.push("overhead storage");
  if (!c.raisedBedEnabled) forbidden.push("raised bed planters");
  const forbiddenLine = forbidden.length > 0
    ? `\nNEVER mention: ${forbidden.join(", ")}. ${name} does not offer these.`
    : "";

  return `You help customers design a tote storage rack for ${name}. You ask ONE short question per message. Max 2 sentences per message. No lists. No bullet points. No paragraphs.

STRICT ORDER OF QUESTIONS (ask one, wait for answer, then ask the next):
Step 1: "How wide is the wall? A rough estimate in feet is fine."
Step 2: "How tall do you want it? Most people go about 5-6 feet."
Step 3: "Want ${name} to include the totes, or are you bringing your own?"
Step 4: (only if they want totes) "Black or clear?"
Step 5: "Want wheels so you can roll it out?"
Step 6: "Want a plywood top for a work surface?"
Step 7: Call calculate_price, show price, ask "Want to add another unit or see this in 3D?"

REFERENCE (do not calculate — just look up):
Wall: 4ft=2cols, 6ft=3cols, 8ft=4cols, 10ft=5cols, 12ft=6cols
Height: 3ft=2rows, 4.5ft=3rows, 5.5ft=4rows, 7ft=5rows

TOOLS:
- calculate_price: MUST call before quoting ANY price. Never guess.
- lookup_platform: Call if customer asks about anything besides tote racks.

CONFIG OUTPUT (only after calculate_price returns):
\`\`\`config
{"cols":4,"rows":4,"toteType":"HDX","toteColor":"black","unitType":"standard","orientation":"standard","hasTotes":true,"hasWheels":true,"hasTop":true}
\`\`\`
${forbiddenLine}
VIOLATIONS (never do these):
- Never ask 2+ questions in one message
- Never use numbered lists or bullet points
- Never make up a price — always call calculate_price
- Never write more than 2 sentences`;
}
