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
    const systemPrompt = `You are an expert construction estimator measuring wall dimensions using a reference object.

REFERENCE OBJECT:
- A storage tote is placed on the floor against the wall.
- The visible face of the tote (facing the camera) is exactly ${referenceWidth} inches wide.
${referenceDepth ? `- The longer side going into the wall is ${referenceDepth} inches.` : ""}
- The tote height is approximately 14.5 to 15 inches.

MEASUREMENT METHOD — PIXEL-BASED RATIO:
1. Locate the storage tote in the image.
2. Measure the tote's visible face width IN PIXELS in the image. Call this T_pixels.
3. Measure the wall width IN PIXELS between its left and right boundaries (corners, door frames, or clear vertical edges). Call this W_pixels.
4. Calculate: wall_width_inches = (W_pixels / T_pixels) × ${referenceWidth}
5. For height: measure the tote height in pixels (T_h_pixels), then measure floor-to-ceiling in pixels (H_pixels). Calculate: wall_height_inches = (H_pixels / T_h_pixels) × 14.75

CRITICAL — PERSPECTIVE & LENS CORRECTIONS:
- The tote and wall are at the same distance from the camera (both against the wall), so the pixel ratio method works well for the section of wall NEAR the tote.
- However, wide-angle phone lenses cause barrel distortion — objects at the edges of the frame appear stretched wider than they actually are.
- IMPORTANT: Phone cameras (especially at close range, 6-12 feet) systematically overestimate dimensions. After your pixel-ratio calculation, apply these corrections:
  * If the photo appears to be taken straight-on from 8+ feet: reduce your estimate by 15-20%
  * If taken from closer or at a slight angle: reduce by 20-30%
  * If taken at a significant angle or very close range: reduce by 25-35%
- The tote may appear proportionally larger in the image if it's closer to the camera than the wall edges. Only trust the ratio in the area immediately around the tote.
- If the tote is near one edge, the opposite wall edge is farther from the camera and appears compressed — do NOT assume uniform scale across the image.

HEIGHT ESTIMATION:
- ALWAYS estimate wall height. Use the tote height (~14.75") as a vertical ruler.
- Standard residential ceiling heights: 96" (8ft) is most common, some garages are 108-120" (9-10ft).
- Apply the same lens correction to height estimates.
- Only omit heightInches if both ceiling and floor are completely invisible.

SANITY CHECKS — USE THESE TO CATCH ERRORS:
- Most residential walls are 96-192" wide (8-16 ft). Walls over 200" are rare.
- Most walls are 96" (8ft) tall. Garage walls may be 96-120".
- A standard interior door is 80" tall × 36" wide. If a door is visible, cross-check your measurement against it.
- If your estimate exceeds 200" for width, you are very likely overestimating.
- ALWAYS err on the side of underestimating — a storage unit that fits is better than one that doesn't.

CONFIDENCE LEVELS:
- "high": Tote clearly visible, straight-on photo, clear wall edges
- "medium": Slight angle, or wall edges partially obscured
- "low": Significant angle, tote partially hidden, or unclear boundaries

Return conservative estimates. Underestimating by 5-10% is far better than overestimating.`;

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // Call Gemini with vision
    const result = await generateObject({
      model: google("gemini-2.0-flash"),
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
