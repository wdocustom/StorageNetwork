// ═══════════════════════════════════════════════════════════════════════════
// VISION MEASURE API — AI-powered wall measurement using tote as reference
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// ── Response Schema ─────────────────────────────────────────────────────────
const MeasurementResultSchema = z.object({
  widthInches: z.number().describe("The estimated wall width in inches"),
  heightInches: z.number().optional().describe("The estimated wall height in inches, if visible"),
  confidence: z.enum(["high", "medium", "low"]).describe("Confidence level of the measurement"),
  reasoning: z.string().describe("Brief explanation of how the measurement was derived"),
});

export type MeasurementResult = z.infer<typeof MeasurementResultSchema>;

// ── Request Body Schema ─────────────────────────────────────────────────────
const RequestBodySchema = z.object({
  image: z.string().describe("Base64-encoded image data"),
  referenceWidth: z.number().positive().describe("Known width of the tote in inches"),
  referenceDepth: z.number().positive().optional().describe("Known depth of the tote in inches"),
});

// ── API Route Handler ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parseResult = RequestBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { image, referenceWidth, referenceDepth } = parseResult.data;

    // Check for API key
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google AI API key not configured" },
        { status: 500 }
      );
    }

    // Initialize Google AI
    const google = createGoogleGenerativeAI({ apiKey });

    // Build the measurement prompt
    const systemPrompt = `You are an expert construction estimator with years of experience measuring spaces for storage installations.

Your task: Analyze the provided image to measure wall dimensions using a reference object (a storage tote) of known size.

REFERENCE OBJECT:
- The storage tote in the image is exactly ${referenceWidth} inches wide${referenceDepth ? ` and ${referenceDepth} inches deep` : ""}.
- Use this as your measuring reference.

INSTRUCTIONS:
1. Locate the storage tote in the image - it should be placed against or near the wall.
2. Using the known tote width as reference, estimate the total usable wall width.
3. If the full wall height is visible, estimate that too.
4. Consider perspective distortion - objects further from the camera appear smaller.
5. Look for visual cues: baseboards, outlets, door frames, ceiling lines.

ACCURACY GUIDELINES:
- "high" confidence: Tote clearly visible, wall edges clearly defined, minimal perspective distortion
- "medium" confidence: Tote visible but at angle, or wall edges partially obscured
- "low" confidence: Significant perspective distortion, tote partially hidden, or unclear wall boundaries

Return your best estimate. It's better to be approximately right than precisely wrong.`;

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // Call Gemini with vision
    const result = await generateObject({
      model: google("gemini-1.5-pro"),
      schema: MeasurementResultSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            {
              type: "image",
              image: base64Data,
            },
          ],
        },
      ],
    });

    return NextResponse.json({
      success: true,
      measurement: result.object,
    });
  } catch (error) {
    console.error("Vision measure error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "Invalid API key configuration" },
          { status: 500 }
        );
      }
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again in a moment." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    );
  }
}
