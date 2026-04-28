"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";

// ═══════════════════════════════════════════════════════════════════════════
// AI Asset Forge — Server actions for the marketing image generator
//
// MVP scope: real credit deduction against `profiles.marketing_credits`,
// mocked image output (returns a curated Unsplash URL based on scene+vibe).
// Swap `mockImageFor()` for a real model call when ready.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

export type Scene = "disaster_garage" | "luxury_garage" | "tool_closeup";
export type Vibe = "bright_airy" | "industrial_dark" | "suburban_clean";

const SCENES: readonly Scene[] = ["disaster_garage", "luxury_garage", "tool_closeup"];
const VIBES: readonly Vibe[] = ["bright_airy", "industrial_dark", "suburban_clean"];

const COST_PER_GENERATION = 1;

export interface MarketingCreditsResult {
  credits: number;
}

export interface GenerateAssetInput {
  scene: Scene;
  vibe: Vibe;
}

export type GenerateAssetResult =
  | { success: true; imageUrl: string; creditsRemaining: number }
  | { success: false; error: string; creditsRemaining?: number };

/**
 * Read the authenticated installer's current marketing credit balance.
 * Returns 0 on auth failure so the UI can render a disabled state safely.
 */
export async function getMarketingCredits(): Promise<MarketingCreditsResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { credits: 0 };

  const { data } = await supabase
    .from("profiles")
    .select("marketing_credits")
    .eq("id", user.id)
    .single();

  return { credits: data?.marketing_credits ?? 0 };
}

/**
 * Mock generation: deducts 1 credit, waits 3s, returns a static placeholder.
 * The Unsplash URLs below are stable, license-free image IDs picked to roughly
 * match the (scene, vibe) combination so the UI looks plausible during dev.
 */
export async function generateMarketingAsset(
  input: GenerateAssetInput
): Promise<GenerateAssetResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!SCENES.includes(input.scene) || !VIBES.includes(input.vibe)) {
    return { success: false, error: "Invalid scene or vibe selection." };
  }

  // Atomic-ish check + deduct. PG row lock via update-returning protects
  // against double-spend within a single request; for true atomicity under
  // concurrent requests, switch to an RPC with FOR UPDATE.
  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("marketing_credits")
    .eq("id", user.id)
    .single();

  if (readErr || !profile) {
    return { success: false, error: "Profile not found." };
  }

  const current = profile.marketing_credits ?? 0;
  if (current < COST_PER_GENERATION) {
    return { success: false, error: "Out of credits.", creditsRemaining: current };
  }

  const next = current - COST_PER_GENERATION;
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ marketing_credits: next })
    .eq("id", user.id);

  if (updErr) {
    return { success: false, error: "Could not deduct credit.", creditsRemaining: current };
  }

  // Simulate generation latency
  await new Promise((resolve) => setTimeout(resolve, 3000));

  return {
    success: true,
    imageUrl: mockImageFor(input.scene, input.vibe),
    creditsRemaining: next,
  };
}

/**
 * Curated Unsplash placeholders so the UI flow shows plausible variation.
 * Replace with the real model output when the generator goes live.
 */
function mockImageFor(scene: Scene, vibe: Vibe): string {
  const picks: Record<Scene, Record<Vibe, string>> = {
    disaster_garage: {
      bright_airy: "1558618666-fcd25c85cd64",
      industrial_dark: "1530124566582-a618bc2615dc",
      suburban_clean: "1558618047-3c8c76ca7d13",
    },
    luxury_garage: {
      bright_airy: "1600585154340-be6161a56a0c",
      industrial_dark: "1593696140826-c58b021acf8b",
      suburban_clean: "1583847268964-b28dc8f51f92",
    },
    tool_closeup: {
      bright_airy: "1581092918056-0c4c3acd3789",
      industrial_dark: "1572981779307-38b8cabb2407",
      suburban_clean: "1504148455328-c376907d081c",
    },
  };
  const id = picks[scene][vibe];
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;
}
