// ═══════════════════════════════════════════════════════════════════════════
// COMMUNITY AUTO-TAG API — Gemini-powered post tagging & routing
// Uses the existing Google AI integration to auto-classify community posts.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

// TODO: Implement Gemini automated moderation and quality scoring

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, communitySlug } = body as {
      title: string;
      content: string;
      communitySlug: string;
    };

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI API key not configured" },
        { status: 500 }
      );
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const systemMessage = `You are a content classification engine for a professional community forum used by storage system installers. Your job is to:

1. Generate 2-5 relevant topic tags from the post content. Tags should be lowercase, hyphenated, and specific to the storage/installer industry.
2. Verify whether the post belongs in the selected community space.
3. Suggest a better community if it doesn't fit.

Available communities and their purposes:
- "general": Open discussion about anything storage-related
- "builds": Showcasing tote rack builds with photos and dimensions
- "business": Business growth, marketing, pricing, customer management
- "tech-help": Technical questions about materials, techniques, troubleshooting
- "features": Feature requests and platform feedback

Respond ONLY with valid JSON in this exact format:
{
  "tags": ["tag-1", "tag-2", "tag-3"],
  "belongsInCommunity": true,
  "suggestedCommunity": null,
  "reason": null
}

If the post doesn't belong in the selected community, set belongsInCommunity to false, suggestedCommunity to the correct slug, and reason to a brief explanation.`;

    const userMessage = `Classify this post:

Community: ${communitySlug}
Title: ${title}
Content: ${content}`;

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await generateText({
          model: google("gemini-2.0-flash"),
          system: systemMessage,
          prompt: userMessage,
        });

        // Parse the JSON response from Gemini
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return NextResponse.json(
            { error: "Failed to parse AI response" },
            { status: 500 }
          );
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          tags: parsed.tags || [],
          belongsInCommunity: parsed.belongsInCommunity ?? true,
          suggestedCommunity: parsed.suggestedCommunity || null,
          reason: parsed.reason || null,
        });
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
    console.error("Auto-tag error:", error);
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
      { error: `Auto-tagging failed: ${message}` },
      { status: 500 }
    );
  }
}
