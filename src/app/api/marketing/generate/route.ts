// ═══════════════════════════════════════════════════════════════════════════
// MARKETING SCRIPT GENERATOR API — Gemini-powered social media copy
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getChatModel, hasChatProvider, generateTextWithFallback } from "@/lib/ai-provider";
import {
  buildSystemMessage,
  buildLocationContext,
  buildPlatformGuide,
  TONE_GUIDES,
  buildFollowUpSystemMessage,
  buildFollowUpUserMessage,
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
      mode = "post",
      followUpHook = "circle-back",
      followUpOffer = "none",
      productCategory,
    } = body as {
      platform: string;
      tone: string;
      city?: string;
      state?: string;
      zip?: string;
      bookingLink: string;
      businessName?: string;
      customTopic?: string;
      mode?: "post" | "followup";
      followUpHook?: string;
      followUpOffer?: string;
      productCategory?: string;
    };

    if (!bookingLink) {
      return NextResponse.json({ error: "Booking link is required" }, { status: 400 });
    }

    if (!hasChatProvider()) {
      return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });
    }

    const model = getChatModel();

    // ── Follow-up mode uses separate prompt builders ───────────────────
    if (mode === "followup") {
      const systemMessage = buildFollowUpSystemMessage();
      const userMessage = buildFollowUpUserMessage(
        followUpHook,
        followUpOffer,
        platform,
        city,
        state,
        businessName,
        bookingLink,
        productCategory,
      );
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await generateTextWithFallback({ model, system: systemMessage, prompt: userMessage });
          return NextResponse.json({ script: result.text });
        } catch (err: unknown) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
          const isRateLimit = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate") || errMsg.includes("RESOURCE_EXHAUSTED");
          if (!isRateLimit || attempt === 2) throw err;
          await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        }
      }
      throw lastError;
    }

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
What they build:
1. **Tote racks:** Wall-mounted, 2x4 lumber, holds 27-gallon HDX bins in rows and columns. Pull any bin out without touching the others — no stacking. 1,000+ lbs, bolted to studs. Call them "tote racks" or "racks" — NOT "sliding tote racks" or "wall racks." The bins pull out, there are no drawer tracks.
2. **Overhead storage:** Same 27-gallon HDX bins, mounted to the ceiling joists. Dead space above your head turned into storage. Holiday stuff, camping gear, seasonal items. Call it "overhead storage" — NOT "overhead ceiling storage."
3. **Open shelving:** Custom heavy-duty shelves from 2x4s for things that don't fit in totes — toolboxes, paint, coolers, sports gear. Wall-mounted or freestanding.
4. **Raised beds / garden beds:** Handmade cedar. Elevated (on legs) or ground-level. 12"×48" to 48"×48". Natural cedar, stained, or painted white. String light post add-on: cedar base with 7-foot center post for outdoor string lights.
5. **Adirondack chairs:** Handmade, solid lumber, classic low-slung profile. Not a box store product. Call them "chairs" or "Adirondack" — NOT "Low Boy Adirondack Chair."
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
        const result = await generateTextWithFallback({
          model,
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
        { error: "AI API key is invalid or not configured. Please check GROQ_API_KEY in your environment." },
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
