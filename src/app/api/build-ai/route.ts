// ═══════════════════════════════════════════════════════════════════════════
// Build AI API — Natural Language → Structured Build Config
//
// Installer types or speaks what they want to build. The AI parses it
// into a structured config that the /build page can add to the quote.
//
// Example inputs:
//   "4x4 with black totes, wheels, and a top"
//   "indiana joe no totes"
//   "two units - a 3x4 with clear totes and a 2x2 with wheels"
//   "6 wide 5 tall, customer bringing their own totes, add wheels"
//
// Returns structured JSON, not a chat stream.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { calculateBuild } from "@/app/actions/calculator";
import type { InstallerPricing } from "@/types/viewModels";

export const maxDuration = 15;

const UnitSchema = z.object({
  wallWidthInches: z.number().optional().describe("Wall width in inches if the installer specified dimensions (e.g. 120 for a 120\" wall or 10ft wall)"),
  wallHeightInches: z.number().optional().describe("Wall height in inches if the installer specified height dimensions"),
  cols: z.number().int().min(0).max(12).describe("Number of columns wide. Set to 0 if wall dimensions are given instead — the server will calculate."),
  rows: z.number().int().min(0).max(6).describe("Number of tiers/rows tall. Set to 0 if wall height is given instead."),
  toteColor: z.enum(["black", "clear"]).default("black").describe("Tote color if including totes"),
  hasTotes: z.boolean().describe("Whether to include totes"),
  hasWheels: z.boolean().describe("Whether to add industrial casters"),
  hasTop: z.boolean().describe("Whether to add a plywood countertop"),
  presetId: z.string().optional().describe("Bestseller preset ID if this matches a known preset (indiana-joe, cornhusker, long-ranger, gas-station, track-norris)"),
  description: z.string().describe("Human-readable description of this unit"),
});

const BuildResponseSchema = z.object({
  units: z.array(UnitSchema).min(1).describe("Array of units to build"),
  notes: z.string().optional().describe("Any clarification notes for the installer"),
});

const SYSTEM_PROMPT = `You are a build configuration parser for Storage Network — a tote rack storage platform. An installer is telling you what they want to build for a customer. Parse their natural language into structured unit configurations.

KNOWN PRESETS (use presetId when the installer clearly references one):
- "indiana-joe" or "Indiana Joe": Three units — 2×4 + 2×2 + 2×4. 20 tote slots total.
- "cornhusker" or "Cornhusker": Single 4×4 on wheels with a top. 16 slots.
- "long-ranger" or "Long Ranger": Two units — 2×4 + 4×2. 16 slots.
- "gas-station" or "Gas Station" or "Gass Station": Three units — 1×4 + 4×2 + 1×4. 16 slots.
- "track-norris" or "Track Norris": Single 4×2 with drawer slides. 8 slots. Totes are mandatory.

PARSING RULES:
- "4x4" or "4 wide 4 tall" or "4 columns 4 rows" = cols:4, rows:4
- "with totes" or "include totes" = hasTotes:true. "no totes" or "without totes" or "bringing their own" = hasTotes:false
- "clear totes" = toteColor:"clear". Default is "black".
- "with wheels" or "on wheels" or "add casters" = hasWheels:true
- "with a top" or "add top" or "countertop" or "plywood top" = hasTop:true
- If not mentioned, default: hasTotes:true, hasWheels:false, hasTop:false, toteColor:"black"
- "two units" or "and also" = multiple entries in the units array
- If they mention a preset by name, set presetId and ignore cols/rows (set cols:0, rows:0 — the frontend handles preset expansion)
- For the description field, write a concise label like "4×4 Standard w/ Totes & Wheels" or "Indiana Joe (no totes)"

WALL DIMENSIONS — CRITICAL:
- If the installer gives wall dimensions (e.g. "120 inches wide" or "10 foot wall" or "120x75"), set wallWidthInches and wallHeightInches and set cols:0 and rows:0.
- NEVER calculate columns or rows from wall dimensions yourself. The server has a precise calculator that accounts for post widths, slot sizes, and tolerances. Just pass the raw inches.
- Convert feet to inches: 10ft = 120", 8ft = 96", 12ft = 144", etc.
- If they say "120x75" that means 120" wide by 75" tall.

IMPORTANT:
- Always return valid JSON matching the schema
- If the input is ambiguous, make reasonable assumptions and add a note
- cols is the width (number of tote slots across), rows is the height (number of tiers up)
- Maximum practical size: 12 columns wide, 5 rows tall
- NEVER do math to convert wall dimensions to columns/rows — let the server handle it`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  let body: { input?: string; installerPricing?: InstallerPricing };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const input = body.input?.trim();
  if (!input) {
    return NextResponse.json({ error: "Input required" }, { status: 400 });
  }

  try {
    const google = createGoogleGenerativeAI({ apiKey });
    const model = process.env.AI_CHAT_MODEL || "gemini-2.0-flash";

    const result = await generateObject({
      model: google(model),
      system: SYSTEM_PROMPT,
      prompt: input,
      schema: BuildResponseSchema,
    });

    // Post-process: resolve wall dimensions into cols/rows using real calculator
    const resolvedUnits = [];
    for (const unit of result.object.units) {
      if (unit.wallWidthInches && unit.cols === 0) {
        // Use wallFit mode to get correct cols/rows from the real calculator
        const calcResult = await calculateBuild({
          wallWidth: unit.wallWidthInches,
          wallHeight: unit.wallHeightInches || 96,
          toteModel: "HDX",
          toteColor: unit.toteColor,
          unitType: "standard",
          orientation: "standard",
          addOns: { totes: unit.hasTotes, wheels: unit.hasWheels, top: unit.hasTop },
          mode: "wallFit",
          installerPricing: body.installerPricing,
        });
        if ("cols" in calcResult && "rows" in calcResult) {
          resolvedUnits.push({
            ...unit,
            cols: calcResult.cols,
            rows: calcResult.rows,
            description: `${calcResult.cols}×${calcResult.rows} Standard${unit.hasWheels ? " w/ Wheels" : ""}${unit.hasTop ? " & Top" : ""}${unit.hasTotes ? "" : " (no totes)"}`,
          });
        } else {
          resolvedUnits.push(unit);
        }
      } else {
        resolvedUnits.push(unit);
      }
    }

    return NextResponse.json({ units: resolvedUnits, notes: result.object.notes });
  } catch (err) {
    console.error("[BuildAI] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI generation failed" },
      { status: 500 }
    );
  }
}
