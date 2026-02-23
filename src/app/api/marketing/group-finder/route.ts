// ═══════════════════════════════════════════════════════════════════════════
// AI GROUP FINDER API — Gemini-powered local group/page suggestions
//
// Suggests Facebook groups, Craigslist areas, Instagram pages, and other
// platforms where an installer could effectively market their tote storage
// system based on their local area.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { city, state, zip } = body as {
      city?: string;
      state?: string;
      zip?: string;
    };

    if (!city && !state && !zip) {
      return NextResponse.json(
        { error: "Location info is required. Update your profile with city/state." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const location = [city, state].filter(Boolean).join(", ") + (zip ? ` (${zip})` : "");

    const systemMessage = `You are a hyper-local social media marketing strategist for small trade businesses. You help tote storage system installers find the best online groups, pages, and communities to post their services.

Your job: suggest REAL, SPECIFIC types of groups and communities that exist on Facebook, Craigslist, Instagram, and other platforms where a post about custom heavy-duty tote storage racks would perform well.

RULES:
- Suggest groups by their likely REAL names and categories — not generic descriptions
- Focus on LOCAL groups near the installer's area
- Prioritize groups where a service post would be welcome (not spammy)
- Include a mix of: buy/sell/trade groups, mom groups, neighborhood groups, odd-job / handyman groups, home improvement groups, garage organization groups, local marketplace groups
- For each suggestion, explain WHY it's a good fit in one sentence
- Output must be valid JSON matching the schema below — no markdown, no extra text

OUTPUT JSON SCHEMA:
{
  "platforms": [
    {
      "platform": "Facebook",
      "icon": "facebook",
      "groups": [
        {
          "name": "Group or page name/type",
          "category": "Buy/Sell/Trade | Moms | Neighborhood | Odd Jobs | Home Improvement | Marketplace | Other",
          "reason": "One sentence why this is a great fit"
        }
      ]
    },
    {
      "platform": "Craigslist",
      "icon": "craigslist",
      "groups": [
        {
          "name": "Section or area name",
          "category": "Services | For Sale | Gigs",
          "reason": "Why this section works"
        }
      ]
    },
    {
      "platform": "Instagram",
      "icon": "instagram",
      "groups": [
        {
          "name": "Hashtag, page type, or strategy",
          "category": "Hashtag | Page Type | Strategy",
          "reason": "Why this works"
        }
      ]
    },
    {
      "platform": "Other",
      "icon": "other",
      "groups": [
        {
          "name": "Platform / community name",
          "category": "Nextdoor | Reddit | TikTok | Other",
          "reason": "Why this works"
        }
      ]
    }
  ]
}`;

    const userMessage = `Find the best online groups, pages, and communities for a tote storage system installer based in ${location} to market their business.

The installer builds custom heavy-duty sliding tote racks from 2x4 lumber that hold 27-gallon totes. Their ideal customer is a homeowner with a cluttered garage, basement, or shed.

Suggest 6-8 Facebook groups (include buy/sell/trade groups, mommy/parenting groups, neighborhood groups, odd-job/handyman groups, and home improvement groups — all LOCAL to ${location}).

Suggest 2-3 Craigslist sections/areas for the ${location} region.

Suggest 3-4 Instagram strategies (hashtags, types of accounts to engage with, reels strategies).

Suggest 2-3 other platforms or communities (Nextdoor, Reddit local subs, TikTok niches, etc.).

All suggestions should be SPECIFIC to the ${location} area. Use real suburb names, real community types. Output valid JSON only.`;

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await generateText({
          model: google("gemini-2.0-flash"),
          system: systemMessage,
          prompt: userMessage,
        });

        // Parse the JSON response — strip any markdown fences if present
        let jsonText = result.text.trim();
        if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
        }
        const parsed = JSON.parse(jsonText);
        return NextResponse.json(parsed);
      } catch (err: unknown) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
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
    console.error("Group finder error:", error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("quota") || message.includes("429")) {
      return NextResponse.json(
        { error: "AI rate limit reached. Please wait a moment and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: `Failed to find groups: ${message}` },
      { status: 500 }
    );
  }
}
