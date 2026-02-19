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
- Sound like a real neighbor posting, NOT a corporate ad
- Be conversational and relatable — like you'd talk to a neighbor over the fence
- Mention a real local pain point (cluttered garage, basement flooding prep, seasonal cleanup)
- Avoid aggressive sales language — group admins delete obvious ads
- Naturally work in the booking link as a helpful resource, not a sales pitch
- Keep it under 200 words — Facebook groups favor shorter posts`,
      "facebook-page": `This is for the installer's own Facebook business page. It should:
- Be professional but personable
- Showcase expertise and craftsmanship
- Include a strong but not pushy call-to-action
- Can be slightly longer (up to 250 words)
- End with the booking link`,
      "instagram": `This is for Instagram. It should:
- Start with a hook that stops the scroll
- Use short, punchy sentences
- Include relevant emojis (tasteful, not overboard)
- End with a call-to-action and the booking link
- Keep it under 150 words (caption-length)
- Include 3-5 suggested hashtags at the end`,
      nextdoor: `This is for Nextdoor (hyper-local neighborhood app). It should:
- Sound like a verified neighbor offering services
- Reference the specific neighborhood or area
- Be helpful and community-oriented
- Short and direct — Nextdoor users scroll fast
- Include the booking link naturally
- Keep it under 150 words`,
      general: `This is a general-purpose marketing post. Make it adaptable for any platform. Keep it under 200 words and end with the booking link.`,
    };

    const toneGuide: Record<string, string> = {
      professional: "Professional and authoritative. Position the installer as a skilled craftsperson who takes pride in their work. Confident but not arrogant.",
      casual: "Casual and relatable. Like texting a friend about a cool service. Use contractions, be warm and approachable.",
      urgent: "Create genuine urgency. Limited availability, seasonal relevance, or time-sensitive offers. Not fake scarcity — real reasons to act now.",
      storytelling: "Tell a mini-story. A before/after scenario, a satisfied customer moment, or the installer's personal motivation. Make readers feel something.",
    };

    const systemMessage = `You are an elite social media marketing strategist with 15+ years specializing in local service businesses. You've helped hundreds of small businesses generate leads through organic social media, particularly in local Facebook groups and neighborhood platforms.

YOUR EXPERTISE:
- You understand that local Facebook groups are the #1 lead source for home service businesses
- You know that posts sounding like "real people" outperform polished ads 10x
- You've mastered the art of the "soft sell" — providing value while naturally driving leads
- You understand seasonal marketing triggers for home organization services

CRITICAL RULES:
1. The booking link MUST appear naturally in the post — never as "click here" but worked into a sentence
2. NEVER use hashtags on Facebook group posts (they look spammy)
3. NEVER start with "Hey [City]!" — that's the most cliché local marketing opener
4. Do NOT mention pricing or discounts
5. Sound human — use imperfect grammar if the tone calls for it
6. Do NOT use phrases like "transform your space" or "game-changer" — they're overused
7. Write ONLY the post text — no titles, labels, or meta-commentary
8. Do NOT wrap the output in quotes or markdown formatting`;

    const userMessage = `Write a social media post for the following business and context:

BUSINESS:
${businessName ? `Business Name: ${businessName}` : "A professional tote storage system installer"}
Service: Custom-built heavy-duty tote storage racks made from 2x4 lumber and plywood. These systems store 27-gallon totes in organized rows and columns. They're built to last, hold 1000+ lbs per unit, and keep garages, basements, and sheds organized.
Booking Link: ${bookingLink}
The booking link opens a free 3D design tool where customers can visualize and design their own storage system in 30 seconds, then book an installation.

LOCATION CONTEXT:
${locationContext}

PLATFORM:
${platformGuide[platform] || platformGuide.general}

TONE:
${toneGuide[tone] || toneGuide.professional}

${customTopic ? `SPECIFIC TOPIC/ANGLE TO HIGHLIGHT:\n${customTopic}\n` : ""}
Write only the post text. No titles, quotes, or extra formatting.`;

    const result = await generateText({
      model: google("gemini-2.0-flash"),
      system: systemMessage,
      prompt: userMessage,
    });

    return NextResponse.json({ script: result.text });
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
