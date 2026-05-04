"use server";

import Replicate from "replicate";
import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";

// ═══════════════════════════════════════════════════════════════════════════
// AI Asset Forge — Phase 2
//
// Calls Black Forest Labs FLUX.1.1-pro on Replicate to generate a real
// photorealistic marketing image based on the (scene, vibe) selected in
// the UI. Credits are debited atomically via the `decrement_credits`
// Postgres RPC (migration 099) BEFORE the model call so concurrent
// requests cannot double-spend; if the model call fails, we refund.
// ═══════════════════════════════════════════════════════════════════════════

// Lazy singletons. Constructing these at module scope risked a single bad
// env var taking down BOTH exports (including getMarketingCredits, which
// doesn't even need Replicate). Lazy + per-export keeps failures isolated.
let _replicate: Replicate | null = null;
function getReplicate(): Replicate {
  if (_replicate) return _replicate;
  // useFileOutput:false — keep `replicate.run()` returning raw URL strings
  // instead of FileOutput streams; we only need the URL to hand to the browser.
  _replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
    useFileOutput: false,
  });
  return _replicate;
}

const FLUX_MODEL = "black-forest-labs/flux-1.1-pro" as const;

export type Scene = "disaster_garage" | "luxury_garage" | "tool_closeup";
export type Vibe = "bright_airy" | "industrial_dark" | "suburban_clean";
export type AspectRatio = "square" | "landscape" | "portrait";
export type BrandColor =
  | "black_yellow"
  | "white_blue"
  | "natural_cedar"
  | "industrial_gray";

const SCENES: readonly Scene[] = ["disaster_garage", "luxury_garage", "tool_closeup"];
const VIBES: readonly Vibe[] = ["bright_airy", "industrial_dark", "suburban_clean"];
const ASPECT_RATIOS: readonly AspectRatio[] = ["square", "landscape", "portrait"];
const BRAND_COLORS: readonly BrandColor[] = [
  "black_yellow",
  "white_blue",
  "natural_cedar",
  "industrial_gray",
];

// Map our friendly aspect-ratio keys to FLUX's accepted aspect_ratio strings.
const FLUX_ASPECT: Record<AspectRatio, "1:1" | "16:9" | "9:16"> = {
  square: "1:1",
  landscape: "16:9",
  portrait: "9:16",
};

// Brand-color appendage. Phrased as a generic palette hint so it works
// across all scenes (the disaster scene won't have organized totes to
// recolor, but FLUX will pull the palette into props/walls/lighting).
const BRAND_COLOR_HINT: Record<BrandColor, string> = {
  black_yellow:
    "Brand accent palette: matte black with bright yellow safety highlights.",
  white_blue:
    "Brand accent palette: clean white with cobalt-blue accents.",
  natural_cedar:
    "Brand accent palette: natural unstained cedar with warm honey tones.",
  industrial_gray:
    "Brand accent palette: industrial steel gray on gray.",
};

// Cap user-supplied detail so a runaway paste can't blow up the prompt.
const CUSTOM_DETAIL_MAX = 400;

// ── Master prompt dictionary ───────────────────────────────────────────────
// Each (scene, vibe) pair maps to a fully-formed photorealistic prompt.
// Keep these consistent in structure: subject → vibe/lighting → details →
// camera + quality tags. This is the only place prompts should be edited.
//
// NOTE: not exported. "use server" files can only export async functions —
// exporting this object triggers a build-time / runtime error in Next.js.
const PROMPT_TEMPLATES: Record<Scene, Record<Vibe, string>> = {
  disaster_garage: {
    bright_airy:
      "A photorealistic wide-angle shot of a chaotic, cluttered residential garage interior in a before-renovation state. Bright and airy aesthetic, soft natural daylight pouring through the open garage door, clean white walls fighting the mess, scattered cardboard moving boxes, a tangled bicycle on the floor, sports equipment in disarray, dusty workbench overflowing with miscellaneous items. Shot on 35mm lens, high architectural quality, 8k resolution, highly detailed.",
    industrial_dark:
      "A photorealistic wide-angle shot of a chaotic, cluttered residential garage interior in a state of disrepair. Industrial dark aesthetic, single overhead bulb casting deep shadows, cold concrete floor with oil stains, grimy walls and exposed wood studs, broken-down storage piled high, stacked junk and forgotten tools. Shot on 35mm lens, high architectural quality, 8k resolution, highly detailed.",
    suburban_clean:
      "A photorealistic wide-angle shot of a typical American suburban two-car garage cluttered with disorganized household belongings. Bright midday lighting through the open garage door, warm beige walls, neighbor's house visible outside, family bicycles tangled together, plastic bins stacked carelessly, lawn equipment leaning everywhere, garden hose coiled on the floor. Shot on 35mm lens, high architectural quality, 8k resolution, highly detailed.",
  },
  luxury_garage: {
    bright_airy:
      "A photorealistic wide shot of a pristine, luxury garage interior. Bright and airy aesthetic, soft daylight from clerestory windows, white epoxy floor, warm white walls, custom white storage cabinetry, neatly organized clear acrylic storage totes on stainless steel wall racks, hanging tools on perforated white pegboard, immaculate showroom polish. Shot on 35mm lens, high architectural quality, 8k resolution, highly detailed.",
    industrial_dark:
      "A photorealistic wide shot of a pristine, luxury garage interior. Industrial dark aesthetic, moody directional lighting, matte black epoxy floor, heavy-duty black and yellow storage totes neatly organized on heavy-duty steel wall racks. Shot on 35mm lens, high architectural quality, 8k resolution, highly detailed.",
    suburban_clean:
      "A photorealistic wide shot of a pristine, luxury garage interior in a high-end suburban home. Bright midday lighting, light gray epoxy floor, soft beige walls, cherry-stained wood cabinetry, neatly organized translucent storage totes on white-painted steel wall racks, family SUV partially visible, perfectly swept floor. Shot on 35mm lens, high architectural quality, 8k resolution, highly detailed.",
  },
  tool_closeup: {
    bright_airy:
      "A photorealistic close-up macro shot of a meticulously organized hand-tool wall in a residential garage. Bright and airy aesthetic, soft window-lit lighting, clean white pegboard backdrop, gleaming chrome wrenches and screwdrivers seated in shadow-board outlines, color-coded tool clips, shallow depth of field. Shot on 35mm macro lens, studio-quality detail, 8k resolution, highly detailed.",
    industrial_dark:
      "A photorealistic close-up macro shot of a meticulously organized hand-tool wall on heavy-duty steel pegboard. Industrial dark aesthetic, moody directional lighting from a single warm-tungsten work lamp, glinting black and yellow tool grips, brushed stainless wrenches in shadow-board cutouts, deep contrasting shadows. Shot on 35mm macro lens, studio-quality detail, 8k resolution, highly detailed.",
    suburban_clean:
      "A photorealistic close-up macro shot of a tidy hand-tool corner in a clean suburban garage. Bright midday natural lighting, painted white pegboard, neatly arranged hammer, level, and tape measure on labeled hooks, an open clear plastic storage tote of small parts to the side, friendly familiar warmth. Shot on 35mm macro lens, studio-quality detail, 8k resolution, highly detailed.",
  },
};

// ── Public types ───────────────────────────────────────────────────────────

export interface MarketingCreditsResult {
  credits: number;
}

export interface GenerateAssetInput {
  scene: Scene;
  vibe: Vibe;
  /** Defaults to "landscape" (16:9). */
  aspectRatio?: AspectRatio;
  /** Optional brand-color palette nudge. Pass null/omit for none. */
  brandColor?: BrandColor | null;
  /** Optional free-text addendum from the installer. Capped at 400 chars. */
  customDetail?: string;
}

export type GenerateAssetResult =
  | { success: true; imageUrl: string; creditsRemaining: number }
  | { success: false; error: string; creditsRemaining?: number };

// ── Read current balance ───────────────────────────────────────────────────

export async function getMarketingCredits(): Promise<MarketingCreditsResult> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      console.warn("[AssetForge] getMarketingCredits called without auth");
      return { credits: 0 };
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("marketing_credits")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("[AssetForge] getMarketingCredits read error:", error.message);
      return { credits: 0 };
    }

    return { credits: data?.marketing_credits ?? 0 };
  } catch (err) {
    console.error("[AssetForge] getMarketingCredits exception:", err);
    return { credits: 0 };
  }
}

// ── Generate ──────────────────────────────────────────────────────────────

export async function generateMarketingAsset(
  input: GenerateAssetInput
): Promise<GenerateAssetResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!SCENES.includes(input.scene) || !VIBES.includes(input.vibe)) {
    return { success: false, error: "Invalid scene or vibe selection." };
  }

  const aspectRatio: AspectRatio = input.aspectRatio ?? "landscape";
  if (!ASPECT_RATIOS.includes(aspectRatio)) {
    return { success: false, error: "Invalid aspect ratio." };
  }
  if (input.brandColor && !BRAND_COLORS.includes(input.brandColor)) {
    return { success: false, error: "Invalid brand color." };
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    return { success: false, error: "Image generator is not configured." };
  }

  const supabase = getServiceClient();

  // 1. Atomic credit reservation. The RPC raises 'Insufficient credits' if
  //    the balance is already 0 — fail the request before calling the model.
  const { data: remainingAfterDebit, error: rpcErr } = await supabase.rpc(
    "decrement_credits",
    { user_id: user.id }
  );

  if (rpcErr) {
    if (rpcErr.message.includes("Insufficient credits")) {
      return { success: false, error: "Out of credits.", creditsRemaining: 0 };
    }
    console.error("[AssetForge] decrement_credits failed:", rpcErr);
    return { success: false, error: "Could not deduct credit." };
  }

  const creditsRemaining =
    typeof remainingAfterDebit === "number" ? remainingAfterDebit : 0;

  // 2. Build the final prompt and call FLUX.1.1-pro.
  const prompt = buildPrompt(input);

  try {
    const output = await getReplicate().run(FLUX_MODEL, {
      input: {
        prompt,
        aspect_ratio: FLUX_ASPECT[aspectRatio],
        output_format: "png",
      },
    });

    const imageUrl = extractImageUrl(output);
    if (!imageUrl) {
      throw new Error("Replicate returned an empty result.");
    }

    return { success: true, imageUrl, creditsRemaining };
  } catch (err) {
    // 3. Refund on generation failure so the user isn't charged for nothing.
    const { data: restored } = await supabase.rpc("refund_credit", {
      user_id: user.id,
    });
    const refundedBalance =
      typeof restored === "number" ? restored : creditsRemaining + 1;

    console.error("[AssetForge] FLUX generation failed:", err);
    const message =
      err instanceof Error ? err.message : "Generation failed. Credit refunded.";
    return { success: false, error: message, creditsRemaining: refundedBalance };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compose the final FLUX prompt: base scene/vibe template + optional
 * brand-color hint + optional installer-supplied custom detail.
 */
function buildPrompt(input: GenerateAssetInput): string {
  let prompt = PROMPT_TEMPLATES[input.scene][input.vibe];

  if (input.brandColor) {
    prompt += " " + BRAND_COLOR_HINT[input.brandColor];
  }

  const detail = input.customDetail?.trim();
  if (detail) {
    // Cap to keep total prompt size sane and to neutralize accidental
    // novel-length pastes.
    prompt += " Additional details: " + detail.slice(0, CUSTOM_DETAIL_MAX);
  }

  return prompt;
}

/**
 * Defensive URL extraction: FLUX.1.1-pro normally returns a single string URL,
 * but we fall back to handling arrays and Replicate FileOutput-shaped objects
 * in case the SDK or model response shape changes.
 */
function extractImageUrl(output: unknown): string | null {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (output instanceof URL) return output.toString();
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractImageUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (typeof output === "object") {
    const candidate = output as { url?: () => URL | string };
    if (typeof candidate.url === "function") {
      const u = candidate.url();
      return u instanceof URL ? u.toString() : u;
    }
  }
  return null;
}
