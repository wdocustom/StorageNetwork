// ═══════════════════════════════════════════════════════════════════════════
// GROUP FINDER API — Gemini-powered local group/page suggestions
//
// Suggests Facebook groups, Craigslist sections, Instagram pages, etc.
// where an installer's tote organizer posts would perform well.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { city, state, zip, businessName } = body as {
      city?: string;
      state?: string;
      zip?: string;
      businessName?: string;
    };

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI API key not configured" },
        { status: 500 }
      );
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const location = city && state
      ? `${city}, ${state}${zip ? ` (ZIP: ${zip})` : ""}`
      : zip
        ? `ZIP code ${zip}`
        : "their local area";

    const prompt = `You are a hyperlocal social media marketing strategist for a professional tote storage system installer based in ${location}${businessName ? ` (business: ${businessName})` : ""}.

Their product: Custom heavy-duty sliding tote racks made from 2x4 lumber and plywood that store 27-gallon totes in organized rows/columns. These are installed in garages, basements, sheds, and workshops.

Your job: Suggest REAL, SPECIFIC Facebook groups, Craigslist sections, and Instagram/other platform pages where this installer should post to get customers. Focus on groups where their target audience hangs out.

TARGET AUDIENCE:
- Homeowners with cluttered garages/basements
- Moms organizing household storage
- People doing spring cleaning or moving
- Home improvement enthusiasts
- People in buy/sell/trade groups
- Small business owners needing warehouse organization

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code fences, just raw JSON):
{
  "facebook": [
    {
      "name": "Real group name that exists or would exist in this area",
      "type": "buy-sell-trade | mom-group | neighborhood | home-improvement | community | odd-jobs | marketplace",
      "search_terms": "Short keyword search query to find this type of group on Facebook (e.g. 'Springfield IL buy sell trade')",
      "why": "One sentence why this group is a goldmine for tote rack posts",
      "tip": "One sentence posting tip specific to this type of group"
    }
  ],
  "craigslist": [
    {
      "name": "Section name (e.g., Household Services, Furniture By Owner)",
      "type": "services | for-sale | community | gigs",
      "subdomain": "The exact Craigslist city subdomain for this metro area (e.g. 'chicago', 'sfbay', 'losangeles', 'springfieldil', 'fortwayne')",
      "section_code": "The exact Craigslist search section abbreviation code (e.g. 'hss' for household services, 'fuo' for furniture by owner, 'sss' for all for sale, 'lbg' for labor gigs, 'sks' for skilled trade services, 'ccc' for community)",
      "why": "Why this section works",
      "tip": "Posting tip"
    }
  ],
  "other": [
    {
      "platform": "Instagram | Nextdoor | TikTok | Reddit | etc.",
      "name": "Specific page, subreddit, hashtag community, or strategy",
      "type": "hashtag | page | subreddit | community | strategy",
      "why": "Why this works",
      "tip": "Posting tip"
    }
  ]
}

RULES:
- Suggest 6-8 Facebook groups (mix of buy/sell/trade, mom groups, neighborhood groups, home improvement, odd jobs)
- Suggest 3-4 Craigslist sections
- Suggest 3-4 other platforms (Instagram, Nextdoor, TikTok, Reddit, etc.)
- Use REAL, PLAUSIBLE group names that would exist in ${location} — include the actual city/area name in the group names
- For Facebook: focus on local buy/sell/trade groups, mom groups, homeowner groups, neighborhood groups, handyman/odd-job groups, garage sale groups
- CRITICAL for Facebook "search_terms": provide short, generic keyword phrases that will find REAL groups on Facebook search. Use the city/state + group category keywords (e.g. "Austin TX garage sale", "Austin TX moms group", "Austin TX home improvement"). Do NOT use the exact group name — use broad search terms that match real groups.
- Be specific: "${city || "Local City"} Garage Sale" not "Local Garage Sale Group"
- CRITICAL for Craigslist "subdomain": use the EXACT Craigslist subdomain for this metro area. Common examples: newyork, chicago, losangeles, sfbay, seattle, portland, denver, austin, dallas, houston, atlanta, miami, boston, philadelphia, phoenix, sandiego, minneapolis, stlouis, detroit, nashville, raleigh, charlotte, orlando, tampa, jacksonville, richmond, norfolk, sacramento, sanjose, fortworth, columbus, cleveland, cincinnati, pittsburgh, indianapolis, kansascity, saltlakecity, lasvegas. For smaller cities, it's often the city name (lowercase, no spaces) sometimes with state abbreviation appended (e.g. "springfieldil", "springfieldmo").
- CRITICAL for Craigslist "section_code": use EXACT Craigslist section codes. Valid codes: "hss" (household services), "fuo" (furniture by owner), "fod" (furniture by dealer), "sss" (all for sale by owner), "lbg" (labor gigs), "sks" (skilled trade services), "ccc" (community all), "dmg" (domestic gigs), "hsg" (household gigs)
- Every suggestion must be actionable — the installer should be able to search for this group and find it (or something very similar)
- Output ONLY valid JSON — no markdown fences, no explanation text before/after`;

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await generateText({
          model: google("gemini-2.0-flash"),
          prompt,
        });

        // Parse the JSON response
        const text = result.text.trim();
        // Strip markdown code fences if present
        const cleaned = text
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        const suggestions = JSON.parse(cleaned);
        return NextResponse.json({ suggestions });
      } catch (err: unknown) {
        lastError = err;
        const errMsg =
          err instanceof Error ? err.message : JSON.stringify(err);
        const isRateLimit =
          errMsg.includes("429") ||
          errMsg.includes("quota") ||
          errMsg.includes("rate") ||
          errMsg.includes("RESOURCE_EXHAUSTED");
        if (!isRateLimit || attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
      }
    }
    throw lastError;
  } catch (error: unknown) {
    console.error("Group suggest error:", error);

    let message: string;
    if (error instanceof Error) {
      message = error.message;
      if ((error as any).cause instanceof Error) {
        message = (error as any).cause.message;
      }
    } else if (typeof error === "object" && error !== null) {
      message =
        (error as any).message ||
        (error as any).error ||
        JSON.stringify(error);
    } else {
      message = String(error);
    }

    if (message.includes("API key") || message.includes("API_KEY_INVALID")) {
      return NextResponse.json(
        { error: "Google AI API key is not configured." },
        { status: 500 }
      );
    }
    if (message.includes("quota") || message.includes("rate limit") || message.includes("429")) {
      return NextResponse.json(
        { error: "AI rate limit reached. Please wait and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: `Failed to generate suggestions: ${message}` },
      { status: 500 }
    );
  }
}
