// ═══════════════════════════════════════════════════════════════════════════
// MARKETING SCRIPT GENERATOR API — Gemini-powered social media copy
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import {
  buildSystemMessage,
  buildLocationContext,
  buildPlatformGuide,
  TONE_GUIDES,
} from "../prompt-config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      platform = "facebook-group",
      tone = "professional",
      city,
      state,
      zip,
      bookingLink,
      businessName,
      customTopic,
    } = body as {
      platform: string;
      tone: string;
      city?: string;
      state?: string;
      zip?: string;
      bookingLink: string;
      businessName?: string;
      customTopic?: string;
    };

    if (!bookingLink) {
      return NextResponse.json({ error: "Booking link is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const isFacebook = platform.startsWith("facebook-");
    const locationContext = buildLocationContext(city, state, zip);
    const platformGuides = buildPlatformGuide(platform, city);
    const platformGuide = platformGuides[platform] || platformGuides.general;
    const toneGuide = TONE_GUIDES[tone] || TONE_GUIDES.professional;
    const systemMessage = buildSystemMessage(platform);

    const ctaReminder = isFacebook
      ? `IMPORTANT: This is a FACEBOOK post. Do NOT include any URL or booking link anywhere in the post.
Facebook algorithmically suppresses posts and comments that contain links. The ONLY reliable way to get someone to the configurator is via Messenger DM.
- The CTA must drive DMs and/or comments: "Shoot me a DM", "Send me a message", "Drop a comment and I'll reach out"
- Do NOT say "check the first comment for the link" — links in FB comments get suppressed too
- The installer will send their configurator link directly via Messenger to anyone who DMs or comments
- Make the DM feel valuable: "Send me a photo of your wall and I'll tell you what fits" — not just "DM me for a link"`
      : `IMPORTANT: Do NOT include the booking link URL anywhere in the generated post. Instead, direct readers to "check the first comment for the link" or "link in comments". The installer will paste the link as their first comment where it IS clickable.`;

    const userMessage = `Write a social media post AS THE INSTALLER (first person — "I", "my") for the following business:

THE INSTALLER'S BUSINESS:
${businessName ? `Business Name: ${businessName}` : "They are a professional custom storage system installer"}
What they build — THREE product lines:
1. **Wall-Mounted Tote Storage Racks:** Custom heavy-duty racks made from 2x4 lumber and plywood. Store 27-gallon HDX totes in organized rows and columns — every bin slides out like a drawer. Hold 1,000+ lbs per unit. Bolted to wall studs. Optional locking casters.
2. **Overhead Ceiling Storage:** A 4-layer system lagged to ceiling joists. Turns dead space above your head into organized tote storage. Perfect for seasonal items, holiday decorations, camping gear. Uses the same 27-gallon HDX totes.
3. **Open Shelving (Bonus Add-On):** Custom heavy-duty open shelves for items that don't fit in totes — toolboxes, paint cans, coolers, sports equipment. Wall-mounted or freestanding.
Their Booking Link (for internal reference only — DO NOT put this URL in the post): ${bookingLink}
The booking link opens a free 3D design tool where customers can visualize and design their own storage system in 30 seconds, then book an installation.
${ctaReminder}

LOCATION CONTEXT:
${locationContext}

PLATFORM:
${platformGuide}

TONE:
${toneGuide}

${customTopic ? `SPECIFIC TOPIC/ANGLE TO HIGHLIGHT:\n${customTopic}\n` : ""}
REMEMBER:
- Write as the installer in first person. They are posting this themselves to get leads.
- Use MARKDOWN formatting: ## H2 headers, ### H3 sub-headers, **bold**, bullet points, numbered lists.
- Do NOT include any pricing, dollar amounts, or package tiers. The configurator handles pricing.
- MUST end with --- followed by a "### Pro-Tips for Posting:" section with 2-3 actionable bullets.${isFacebook ? '\n- Pro-Tips MUST include: "When someone DMs or comments, reply with your configurator link — it\'s fully clickable inside Messenger"' : ""}
- ABSOLUTELY NO bracketed placeholders like [City], [Suburb 1], [Local Sports Team]. Use REAL names or natural generic phrasing. The installer will copy-paste this verbatim.
- No customer testimonials, no third-person descriptions. Just the installer talking about what they do.

Write the full structured post now.`;

    // Retry with exponential backoff for transient rate limits
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await generateText({
          model: google("gemini-2.0-flash"),
          system: systemMessage,
          prompt: userMessage,
        });
        return NextResponse.json({ script: result.text });
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
        // Wait 2s, then 4s before retrying
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
      }
    }
    throw lastError;
  } catch (error: unknown) {
    console.error("Marketing generate error:", error);

    // Extract message from any error shape (AI SDK may throw non-Error objects)
    let message: string;
    if (error instanceof Error) {
      message = error.message;
      // AI SDK errors often nest the real cause
      if ((error as any).cause instanceof Error) {
        message = (error as any).cause.message;
      }
    } else if (typeof error === "object" && error !== null) {
      message =
        (error as any).message ||
        (error as any).error ||
        (error as any).statusText ||
        JSON.stringify(error);
    } else {
      message = String(error);
    }

    if (message.includes("API key") || message.includes("apiKey") || message.includes("API_KEY_INVALID")) {
      return NextResponse.json(
        { error: "Google AI API key is invalid or not configured. Please check GOOGLE_GENERATIVE_AI_API_KEY in your environment." },
        { status: 500 }
      );
    }
    if (message.includes("quota") || message.includes("rate limit") || message.includes("429")) {
      return NextResponse.json(
        { error: "AI rate limit reached. Please wait a moment and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: `Failed to generate script: ${message}` },
      { status: 500 }
    );
  }
}
