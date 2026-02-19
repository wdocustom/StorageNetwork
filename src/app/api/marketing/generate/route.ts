// ═══════════════════════════════════════════════════════════════════════════
// MARKETING SCRIPT GENERATOR API — Gemini-powered social media copy
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const RequestSchema = {
  platform: ["facebook-group", "facebook-page", "instagram", "nextdoor", "general"] as const,
  tone: ["professional", "casual", "urgent", "storytelling"] as const,
};

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

    const locationContext = city && state
      ? `The installer is based in ${city}, ${state}${zip ? ` (ZIP: ${zip})` : ""}. Reference local landmarks, neighborhoods, weather patterns (hot summers = garage cleanup, fall = organize before holidays, etc.), and community pride. Make it feel like it was written by a local.`
      : zip
        ? `The installer is in ZIP code ${zip}. Reference the local area naturally.`
        : "No specific location provided. Keep the copy general but still personal.";

    const platformGuide: Record<string, string> = {
      "facebook-group": `This is for a LOCAL Facebook community group (e.g., "${city || "Your City"} Buy/Sell/Trade", "${city || "Local"} Homeowners", neighborhood groups). The post must:
- Be written in FIRST PERSON as the installer talking about their own work/business
- Sound like a real local tradesperson posting in the group — NOT a corporate ad, NOT a customer testimonial
- The installer is casually mentioning what they do, maybe sharing a recent job, offering to help neighbors
- Mention a real local pain point (cluttered garage, basement flooding prep, seasonal cleanup)
- Avoid aggressive sales language — group admins delete obvious ads
- Naturally work in the booking link as a helpful resource
- Keep it under 200 words — Facebook groups favor shorter posts`,
      "facebook-page": `This is for the installer's own Facebook business page. It should:
- Be written in FIRST PERSON as the installer/business owner
- Showcase their expertise, pride in craftsmanship, and recent work
- Talk about what they build, why they love it, and how it helps people
- Include a strong but not pushy call-to-action
- Can be slightly longer (up to 250 words)
- End with the booking link`,
      "instagram": `This is for Instagram. It should:
- Be written in FIRST PERSON as the installer sharing their work
- Start with a hook that stops the scroll
- Use short, punchy sentences — the installer showing off a build or talking shop
- Include relevant emojis (tasteful, not overboard)
- End with a call-to-action and the booking link
- Keep it under 150 words (caption-length)
- Include 3-5 suggested hashtags at the end`,
      nextdoor: `This is for Nextdoor (hyper-local neighborhood app). It should:
- Be written in FIRST PERSON as a local installer/neighbor offering their services
- Sound like a verified neighbor who happens to build storage systems
- Reference the specific neighborhood or area
- Be helpful and community-oriented
- Short and direct — Nextdoor users scroll fast
- Include the booking link naturally
- Keep it under 150 words`,
      general: `This is a general-purpose marketing post. Write it in FIRST PERSON as the installer promoting their own business. Keep it under 200 words and end with the booking link.`,
    };

    const toneGuide: Record<string, string> = {
      professional: "Professional and authoritative. The installer speaks as a skilled craftsperson who takes pride in their work. Confident but not arrogant. They know their stuff and it shows.",
      casual: "Casual and relatable. The installer talks like they're chatting with a buddy about what they do for a living. Contractions, warmth, approachable.",
      urgent: "The installer communicates genuine urgency — their schedule is filling up, season is changing, limited availability. Not fake scarcity — real reasons to book now.",
      storytelling: "The installer tells a mini-story from THEIR perspective — a recent job they're proud of, a before/after they just finished, why they got into this trade, a problem they solved for a client. First-person narrative from the builder, never from the customer.",
    };

    const systemMessage = `You are a ghostwriter for a local tote storage system installer. Every post you write is in the FIRST PERSON voice of the installer — "I", "my", "we" — as if the installer typed it themselves.

THE INSTALLER'S IDENTITY:
- They are a hands-on builder/craftsperson who custom-builds heavy-duty storage rack systems
- They take pride in their work — they build things that last and solve real problems
- They're a local small business owner trying to grow through word of mouth and social media
- They talk like a real tradesperson, not a marketing agency — no corporate-speak
- They want to generate leads and get bookings, but they're not pushy about it

VOICE RULES — THE POST MUST SOUND LIKE THE INSTALLER WROTE IT:
- ALWAYS first person: "I build...", "Just finished a job...", "I've got a few spots open..."
- NEVER write from a customer's perspective or as a testimonial — no "My husband..." or "We hired..." or fictional customer stories
- NEVER write as a third party describing the installer — no "This local business..." or "They offer..."
- The installer is proud of what they build and talks about it naturally
- They might reference a recent job, a common problem they solve, or why they love what they do

CRITICAL RULES:
1. The booking link MUST appear naturally in the post — never as "click here" but worked into a sentence
2. NEVER use hashtags on Facebook group posts (they look spammy)
3. NEVER start with "Hey [City]!" — that's the most cliché local marketing opener
4. Do NOT mention pricing or discounts
5. Sound human — use imperfect grammar if the tone calls for it
6. Do NOT use phrases like "transform your space" or "game-changer" — they're overused
7. Write ONLY the post text — no titles, labels, or meta-commentary
8. Do NOT wrap the output in quotes or markdown formatting
9. NEVER write as a customer, reviewer, or testimonial — ALWAYS as the installer themselves`;

    const userMessage = `Write a social media post AS THE INSTALLER (first person — "I", "my") for the following business:

THE INSTALLER'S BUSINESS:
${businessName ? `Business Name: ${businessName}` : "They are a professional tote storage system installer"}
What they build: Custom heavy-duty tote storage racks made from 2x4 lumber and plywood. These systems store 27-gallon totes in organized rows and columns. Built to last, hold 1000+ lbs per unit, and keep garages, basements, and sheds organized.
Their Booking Link: ${bookingLink}
The booking link opens a free 3D design tool where customers can visualize and design their own storage system in 30 seconds, then book an installation.

LOCATION CONTEXT:
${locationContext}

PLATFORM:
${platformGuide[platform] || platformGuide.general}

TONE:
${toneGuide[tone] || toneGuide.professional}

${customTopic ? `SPECIFIC TOPIC/ANGLE TO HIGHLIGHT:\n${customTopic}\n` : ""}
REMEMBER: Write as the installer in first person. They are posting this themselves to get leads. No customer testimonials, no third-person descriptions. Just the installer talking about what they do.

Write only the post text. No titles, quotes, or extra formatting.`;

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
