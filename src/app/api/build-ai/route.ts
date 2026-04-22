// ═══════════════════════════════════════════════════════════════════════════
// Build AI API — Natural Language → Structured Build Config
//
// Installer types or speaks what they want to build. The AI parses it
// into structured configs. Uses generateText with JSON extraction
// (more reliable than generateObject for complex multi-unit inputs).
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getChatModel, hasChatProvider, generateTextWithFallback } from "@/lib/ai-provider";
import { calculateBuild } from "@/app/actions/calculator";
import { RAISED_BED_SIZES } from "@/lib/raised-beds";
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
  raisedBedConfig?: {
    sizeId: string;
    finish: string;
    hasLiner: boolean;
    depthIncrease: boolean;
    bottomShelf: boolean;
    pestCover: string;
    postHeight: number | null;
    hasHook: boolean;
    highWindWeighted?: boolean;
    quantity: number;
  } | null;
  customPrice?: number | null;
  indoorDelivery?: boolean;
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
  "rack-city-roller": "rack-city-roller",
  "rack city roller": "rack-city-roller",
  "rackcityroller": "rack-city-roller",
  "mayor-of-rack-city": "mayor-of-rack-city",
  "mayor of rack city": "mayor-of-rack-city",
  "mayorofrackcity": "mayor-of-rack-city",
  "rack city mayor": "mayor-of-rack-city",
  "rackcitymayor": "mayor-of-rack-city",
};

// All valid preset IDs (for passthrough when AI returns canonical ID)
const VALID_PRESET_IDS = new Set([
  "indiana-joe", "cornhusker", "long-ranger", "gas-station",
  "track-norris", "rack-city-roller", "mayor-of-rack-city",
]);

function normalizePresetId(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  const key = id.toLowerCase().trim();
  // Check alias map first, then allow passthrough of valid canonical IDs
  return PRESET_ALIASES[key] || (VALID_PRESET_IDS.has(key) ? key : undefined);
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

RAISED BED PLANTERS (use raisedBedConfig with cols:0, rows:0):
- Set cols:0, rows:0 and include a raisedBedConfig object. Do NOT use customPrice for raised beds — pricing is calculated server-side.
- Available sizeId values (WITH LEGS): "legs_18x18x16" (18"×18"), "legs_12x48x16" (12"×48"), "legs_24x48x16" (24"×48"), "legs_24x48x30" (24"×48" tall/30"), "legs_24x72x16" (24"×72"), "legs_24x24x16_post" (24"×24" + built-in 7' string light post — BESTSELLER)
- Available sizeId values (GROUND LEVEL / WITHOUT LEGS): "ground_18x72x22" (18"×72"×22.5" — BESTSELLER), "ground_24x72x11" (24"×72"×11.5"), "ground_24x72x22" (24"×72"×22.5" — BESTSELLER), "ground_36x72x22" (36"×72"×22.5"), "ground_48x48x22" (48"×48"×22.5")
- finish: "natural" (default), "stain" (cedar stain), "painted_white"
- hasLiner: true/false (landscape liner)
- depthIncrease: true/false (increase depth to 12" — only for "with legs" sizes)
- bottomShelf: true/false (only for legs_24x48x30)
- pestCover: "none", "hoop", "rigid_cage", "cabinet_24", "cabinet_48"
- postHeight: null, 72 (6' post), 84 (7' post), or 96 (8' post) — add-on post for hanging plants/lights. Available on ALL beds (elevated and ground-level), EXCEPT legs_24x24x16_post (which already has a built-in 7' post).
- hasHook: true/false (hook attachment, requires a post)
- highWindWeighted: true/false (high-wind weighted base anchor kit — elevated planters only)
- quantity: number of identical beds (default 1)
- Match sizes by dimensions mentioned (e.g. "18x18" = legs_18x18x16, "24x72 ground" = ground_24x72x22 or ground_24x72x11)
- Keywords: "raised bed", "planter", "planter box", "garden bed"
- "with legs" / "elevated" / "raised" = with_legs style; "ground" / "ground level" = without_legs style

CUSTOM PRODUCTS (use cols:0, rows:0 with customPrice and description):
- Garage cleanout / junk removal services
- Custom shelf builds, floating shelves, wall-mounted storage
- Workbenches, tool stations, pegboard installations
- Any other custom service or product the installer describes
- Benches, tables, or other woodworking items

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
- INDOOR DELIVERY: When the user mentions "inside", "indoor", "in the house", "in the basement", "bring inside", or "indoor delivery", set indoorDelivery:true on those units. Default is false (omit the field).
- OVERHEAD CEILING STORAGE: When the user mentions "overhead", "ceiling storage", or "ceiling totes", set overheadGridPresetId to the grid size (e.g. "3x4") and cols:0, rows:0. Do NOT set presetId or customPrice for overhead units.

RESPOND WITH ONLY A JSON OBJECT in this exact format — no markdown, no explanation, just JSON:
{"units":[{"cols":4,"rows":4,"toteColor":"black","hasTotes":true,"hasWheels":true,"hasTop":true,"presetId":null,"overheadGridPresetId":null,"raisedBedConfig":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":null,"description":"4×4 w/ Totes, Wheels & Top"}],"notes":null}

With custom price override:
{"units":[{"cols":4,"rows":4,"toteColor":"black","hasTotes":true,"hasWheels":true,"hasTop":true,"presetId":null,"overheadGridPresetId":null,"raisedBedConfig":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":500,"description":"4×4 w/ Totes, Wheels & Top (custom $500)"}],"notes":null}

For raised bed planters:
{"units":[{"cols":0,"rows":0,"toteColor":"black","hasTotes":false,"hasWheels":false,"hasTop":false,"presetId":null,"overheadGridPresetId":null,"raisedBedConfig":{"sizeId":"legs_18x18x16","finish":"stain","hasLiner":true,"depthIncrease":true,"bottomShelf":false,"pestCover":"none","postHeight":72,"hasHook":true,"quantity":4},"wallWidthInches":null,"wallHeightInches":null,"customPrice":null,"description":"18\\"×18\\" Raised Bed (with legs) + Stain + Liner + 12\\" Depth + 6' Post + Hook × 4"}],"notes":null}

For custom line items:
{"units":[{"cols":0,"rows":0,"toteColor":"black","hasTotes":false,"hasWheels":false,"hasTop":false,"presetId":null,"overheadGridPresetId":null,"raisedBedConfig":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":349,"description":"Garage cleanout — 2 car"}],"notes":null}

For overhead ceiling storage:
{"units":[{"cols":0,"rows":0,"toteColor":"black","hasTotes":true,"hasWheels":false,"hasTop":false,"presetId":null,"overheadGridPresetId":"3x4","raisedBedConfig":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":null,"description":"Overhead Ceiling Storage: 3 × 4 (12 totes)"}],"notes":null}

For mixed quotes (storage + overhead + raised beds + custom items):
{"units":[{"cols":4,"rows":4,"toteColor":"black","hasTotes":true,"hasWheels":true,"hasTop":true,"presetId":null,"overheadGridPresetId":null,"raisedBedConfig":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":null,"description":"4×4 w/ Totes, Wheels & Top"},{"cols":0,"rows":0,"toteColor":"black","hasTotes":true,"hasWheels":false,"hasTop":false,"presetId":null,"overheadGridPresetId":"3x3","raisedBedConfig":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":null,"description":"Overhead Ceiling Storage: 3 × 3 (9 totes)"},{"cols":0,"rows":0,"toteColor":"black","hasTotes":false,"hasWheels":false,"hasTop":false,"presetId":null,"overheadGridPresetId":null,"raisedBedConfig":{"sizeId":"legs_24x48x16","finish":"natural","hasLiner":false,"depthIncrease":false,"bottomShelf":false,"pestCover":"none","postHeight":null,"hasHook":false,"quantity":1},"wallWidthInches":null,"wallHeightInches":null,"customPrice":null,"description":"24\\"×48\\" Raised Bed (with legs)"},{"cols":0,"rows":0,"toteColor":"black","hasTotes":false,"hasWheels":false,"hasTop":false,"presetId":null,"overheadGridPresetId":null,"raisedBedConfig":null,"wallWidthInches":null,"wallHeightInches":null,"customPrice":285,"description":"Two benches connecting planter bases"}],"notes":null}`;

export async function POST(req: NextRequest) {
  if (!hasChatProvider()) {
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
    const result = await generateTextWithFallback({
      model: getChatModel(),
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
          raisedBedConfig: undefined,
        });
        continue;
      }

      // Raised bed planter — validate sizeId against known sizes
      if (unit.raisedBedConfig?.sizeId) {
        const validSizeIds = new Set(RAISED_BED_SIZES.map((s) => s.id));
        if (validSizeIds.has(unit.raisedBedConfig.sizeId)) {
          resolvedUnits.push({
            ...unit,
            cols: 0,
            rows: 0,
            toteColor,
            presetId: undefined,
            overheadGridPresetId: undefined,
            customPrice: null,
            raisedBedConfig: {
              sizeId: unit.raisedBedConfig.sizeId,
              finish: unit.raisedBedConfig.finish || "natural",
              hasLiner: unit.raisedBedConfig.hasLiner === true,
              depthIncrease: unit.raisedBedConfig.depthIncrease === true,
              bottomShelf: unit.raisedBedConfig.bottomShelf === true,
              pestCover: unit.raisedBedConfig.pestCover || "none",
              postHeight: unit.raisedBedConfig.postHeight ?? null,
              hasHook: unit.raisedBedConfig.hasHook === true,
              highWindWeighted: unit.raisedBedConfig.highWindWeighted === true,
              quantity: Math.max(1, unit.raisedBedConfig.quantity || 1),
            },
          });
          continue;
        }
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
