// ═══════════════════════════════════════════════════════════════════════════
// Build AI API — Natural Language → Structured Build Config
//
// Installer types or speaks what they want to build. The AI parses it
// into structured configs. Uses generateText with JSON extraction
// (more reliable than generateObject for complex multi-unit inputs).
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { calculateBuild } from "@/app/actions/calculator";
import type { InstallerPricing } from "@/types/viewModels";

export const maxDuration = 15;

interface ParsedUnit {
  wallWidthInches?: number | null;
  wallHeightInches?: number | null;
  cols: number;
  rows: number;
  toteColor: string;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  presetId?: string | null;
  overheadGridPresetId?: string | null;
  customPrice?: number | null;
  description: string;
}

// Preset ID normalization (handles typos)
const PRESET_ALIASES: Record<string, string> = {
  "indiana-joe": "indiana-joe",
  "indianajoe": "indiana-joe",
  "indiana joe": "indiana-joe",
  "cornhusker": "cornhusker",
  "long-ranger": "long-ranger",
  "longranger": "long-ranger",
  "long ranger": "long-ranger",
  "gas-station": "gas-station",
  "gasstation": "gas-station",
  "gas station": "gas-station",
  "gass-station": "gas-station",
  "gass station": "gas-station",
  "track-norris": "track-norris",
  "tracknorris": "track-norris",
  "track norris": "track-norris",
};

function normalizePresetId(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  const normalized = PRESET_ALIASES[id.toLowerCase().trim()];
  return normalized || undefined;
}

const SYSTEM_PROMPT = `You are a build configuration parser for Storage Network. Parse the installer's natural language into a JSON array of unit configurations.

KNOWN PRESETS (use presetId when referenced by name):
- "indiana-joe": Three units — 2×4 + 2×2 + 2×4. 20 slots.
- "cornhusker": Single 4×4 on wheels with a top. 16 slots.
- "long-ranger": Two units — 2×4 + 4×2. 16 slots.
- "gas-station" (also "gass station"): Three units — 1×4 + 4×2 + 1×4. 16 slots.
- "track-norris": Single 4×2 with drawer slides. 8 slots. Totes mandatory.
- "rack-city-roller" or "Rack City Roller": Single 3×2 with wheels and plywood top. Frame only, NO totes. 6 slots.
- "mayor-of-rack-city" or "Mayor of Rack City": Single 4×2 with wheels and plywood top. Frame only, NO totes. 8 slots.

OVERHEAD CEILING STORAGE (use overheadGridPresetId with cols:0, rows:0):
- Ceiling-mounted tote rail system lagged to joists
- Grid presets: "2x2" (4 totes), "2x3" (6 totes), "3x2" (6 totes), "3x3" (9 totes), "3x4" (12 totes), "4x4" (16 totes)
- Format is slotsWide × slotsDeep (e.g. "3x4 overhead" = 3 wide, 4 deep = 12 totes)
- CAN be mixed with tote organizers and custom items in the same quote
- Keywords: "overhead", "ceiling", "ceiling storage", "overhead rack", "ceiling totes"
- Set overheadGridPresetId to the grid size (e.g. "3x4"), cols:0, rows:0
- Default hasTotes:true for overhead (totes hang from rails)
- toteColor applies (black or clear)

CUSTOM PRODUCTS (use cols:0, rows:0 with customPrice and description):
- Raised planter boxes: Cedar or lumber planter boxes of any dimension. Common sizes: 36"×24", 48"×24", 48"×48", 72"×24". Options include: shelf/bottom shelf, legs/raised, liners, casters/wheels. Typical pricing $200-$500 depending on size and features.
- Garage cleanout / junk removal services
- Custom shelf builds, floating shelves, wall-mounted storage
- Workbenches, tool stations, pegboard installations
- Any other custom service or product the installer describes

RULES:
- "4x4" = cols:4, rows:4
- "with totes" = hasTotes:true, "no totes" / "without totes" = hasTotes:false
- "clear totes" = toteColor:"clear", default = "black"
- "with wheels" = hasWheels:true
- "with a top" / "countertop" = hasTop:true
- Defaults if not mentioned: hasTotes:true, hasWheels:false, hasTop:false, toteColor:"black"
- For presets: set presetId and cols:0, rows:0 (server expands presets)
- For wall dimensions (e.g. "120x75 wall"): set wallWidthInches/wallHeightInches and cols:0, rows:0. NEVER calculate cols from inches.
- Convert feet to inches: 10ft=120", 8ft=96"
- CUSTOM PRICING: If the installer specifies a dollar amount (e.g. "4x4 for $500" or "rack city roller at $275"), set customPrice to that number. This overrides any calculated pricing.
- For custom/arbitrary items with a description and price (e.g. "planter box 36x24 with shelf $350" or "garage cleanout $349"), set cols:0, rows:0, and include the customPrice and description. Parse dimensions and features into a clear description.
- For planter boxes: include dimensions, material, and features in the description (e.g. "Raised Planter Box — 36" × 24" w/ Bottom Shelf")
- If no price is given for a custom item, make a reasonable estimate based on size and features, and note it in the description with "(est.)"
- OVERHEAD CEILING STORAGE: When the user mentions "overhead", "ceiling storage", or "ceiling totes", set overheadGridPresetId to the grid size (e.g. "3x4") and cols:0, rows:0. Do NOT set presetId or customPrice for overhead units.

RESPOND WITH ONLY A JSON OBJECT in this exact format — no markdown, no explanation, just JSON:
{"units":[{"cols":4,"rows":4,"toteColor":"black","hasTotes":true,"hasWheels":true,"hasTop":true,"presetId":null,"overheadGridPresetId":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":null,"description":"4×4 w/ Totes, Wheels & Top"}],"notes":null}

With custom price override:
{"units":[{"cols":4,"rows":4,"toteColor":"black","hasTotes":true,"hasWheels":true,"hasTop":true,"presetId":null,"overheadGridPresetId":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":500,"description":"4×4 w/ Totes, Wheels & Top (custom $500)"}],"notes":null}

For planter boxes:
{"units":[{"cols":0,"rows":0,"toteColor":"black","hasTotes":false,"hasWheels":false,"hasTop":false,"presetId":null,"overheadGridPresetId":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":350,"description":"Raised Planter Box — 36\\" × 24\\" w/ Bottom Shelf"}],"notes":null}

For custom line items:
{"units":[{"cols":0,"rows":0,"toteColor":"black","hasTotes":false,"hasWheels":false,"hasTop":false,"presetId":null,"overheadGridPresetId":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":349,"description":"Garage cleanout — 2 car"}],"notes":null}

For overhead ceiling storage:
{"units":[{"cols":0,"rows":0,"toteColor":"black","hasTotes":true,"hasWheels":false,"hasTop":false,"presetId":null,"overheadGridPresetId":"3x4","wallWidthInches":null,"wallHeightInches":null,"customPrice":null,"description":"Overhead Ceiling Storage: 3 × 4 (12 totes)"}],"notes":null}

For mixed quotes (storage + overhead + custom items):
{"units":[{"cols":4,"rows":4,"toteColor":"black","hasTotes":true,"hasWheels":true,"hasTop":true,"presetId":null,"overheadGridPresetId":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":null,"description":"4×4 w/ Totes, Wheels & Top"},{"cols":0,"rows":0,"toteColor":"black","hasTotes":true,"hasWheels":false,"hasTop":false,"presetId":null,"overheadGridPresetId":"3x3","wallWidthInches":null,"wallHeightInches":null,"customPrice":null,"description":"Overhead Ceiling Storage: 3 × 3 (9 totes)"},{"cols":0,"rows":0,"toteColor":"black","hasTotes":false,"hasWheels":false,"hasTop":false,"presetId":null,"overheadGridPresetId":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":350,"description":"Raised Planter Box — 36\\" × 24\\" w/ Bottom Shelf"}],"notes":null}`;

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

    const result = await generateText({
      model: google(model),
      system: SYSTEM_PROMPT,
      prompt: input,
    });

    // Extract JSON from the response (handle markdown code blocks if present)
    let jsonStr = result.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    let parsed: { units: ParsedUnit[]; notes?: string | null };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("[BuildAI] Failed to parse JSON from model response:", jsonStr);
      return NextResponse.json({ error: "Failed to parse AI response. Try rephrasing." }, { status: 422 });
    }

    if (!parsed.units || !Array.isArray(parsed.units) || parsed.units.length === 0) {
      return NextResponse.json({ error: "No units parsed. Try something like '4x4 with totes and wheels'." }, { status: 422 });
    }

    // Normalize and resolve each unit
    const resolvedUnits: ParsedUnit[] = [];
    for (const unit of parsed.units) {
      // Normalize preset ID (handle typos)
      const presetId = normalizePresetId(unit.presetId);

      // Normalize tote color
      const toteColor = unit.toteColor === "clear" ? "clear" : "black";

      // Normalize overhead grid preset ID
      const VALID_OVERHEAD_GRIDS = ["2x2", "2x3", "3x2", "3x3", "3x4", "4x4"];
      const overheadGridPresetId = unit.overheadGridPresetId && VALID_OVERHEAD_GRIDS.includes(unit.overheadGridPresetId)
        ? unit.overheadGridPresetId
        : undefined;

      // Overhead ceiling storage — pass through with validated grid ID
      if (overheadGridPresetId) {
        resolvedUnits.push({
          ...unit,
          cols: 0,
          rows: 0,
          toteColor,
          overheadGridPresetId,
          presetId: undefined,
        });
        continue;
      }

      // Resolve wall dimensions via real calculator
      if (unit.wallWidthInches && unit.cols === 0) {
        const calcResult = await calculateBuild({
          wallWidth: unit.wallWidthInches,
          wallHeight: unit.wallHeightInches || 96,
          toteModel: "HDX",
          toteColor,
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
            toteColor,
            presetId: undefined,
            description: `${calcResult.cols}×${calcResult.rows} Standard${unit.hasWheels ? " w/ Wheels" : ""}${unit.hasTop ? " & Top" : ""}${!unit.hasTotes ? " (no totes)" : ""}`,
          });
          continue;
        }
      }

      resolvedUnits.push({
        ...unit,
        toteColor,
        presetId: presetId || undefined,
      });
    }

    return NextResponse.json({ units: resolvedUnits, notes: parsed.notes || undefined });
  } catch (err) {
    console.error("[BuildAI] Error processing input:", input, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI generation failed" },
      { status: 500 }
    );
  }
}
