// ═══════════════════════════════════════════════════════════════════════════
// AI Bio Generator — Gemini-powered professional bio for installer profiles
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getChatModel, hasChatProvider, generateTextWithFallback } from "@/lib/ai-provider";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // SECURITY (H-1): bio generator is an installer-only feature on the
  // authenticated dashboard. Reject anon callers before touching the model.
  const authedUser = await getAuthenticatedUser();
  if (!authedUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { businessName, firstName, city, state, existingBio } = body as {
      businessName?: string;
      firstName?: string;
      city?: string;
      state?: string;
      existingBio?: string;
    };

    if (!businessName && !firstName) {
      return NextResponse.json(
        { error: "Business name or first name is required" },
        { status: 400 }
      );
    }

    if (!hasChatProvider()) {
      return NextResponse.json(
        { error: "AI API key not configured" },
        { status: 500 }
      );
    }

    const model = getChatModel();

    const location = [city, state].filter(Boolean).join(", ");
    const name = businessName || firstName || "our company";

    const systemMessage = `You are a professional copywriter for home service contractors. Write a compelling, concise bio for a storage system installer's public portfolio page. This bio will be seen by homeowners considering hiring this installer.

Rules:
- Keep it under 250 characters total. This is critical — count carefully.
- Write in first person ("We" for businesses, "I" for individuals).
- Sound professional, confident, and approachable — like a trusted local contractor.
- Mention the location if provided.
- Mention custom tote storage systems / garage organization as the specialty.
- Do NOT use emojis, hashtags, or marketing fluff.
- Do NOT use quotes around the output.
- Output ONLY the bio text, nothing else.`;

    const userMessage = existingBio
      ? `Rewrite and improve this installer bio for ${name}${location ? ` in ${location}` : ""}. Keep the same general message but make it more professional and concise (under 250 characters):\n\n"${existingBio}"`
      : `Write a professional bio for ${name}${location ? `, a storage system installer in ${location}` : ", a storage system installer"}.`;

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await generateTextWithFallback({
          model,
          system: systemMessage,
          prompt: userMessage,
        });

        return NextResponse.json({ bio: result.text.trim() });
      } catch (err: unknown) {
        lastError = err;
        const errMsg =
          err instanceof Error ? err.message : JSON.stringify(err);
        const isRateLimit =
          errMsg.includes("429") ||
          errMsg.includes("quota") ||
          errMsg.includes("RESOURCE_EXHAUSTED");
        if (!isRateLimit || attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
      }
    }
    throw lastError;
  } catch (error: unknown) {
    console.error("Bio generation error:", error);
    const message =
      error instanceof Error ? error.message : String(error);

    if (
      message.includes("429") ||
      message.includes("quota") ||
      message.includes("rate")
    ) {
      return NextResponse.json(
        { error: "AI rate limit reached. Please try again shortly." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Bio generation failed: ${message}` },
      { status: 500 }
    );
  }
}
