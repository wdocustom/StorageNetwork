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
- A storage tote is placed against the wall with its shorter side facing the camera.
- The visible face of the tote is exactly ${referenceWidth} inches wide${referenceDepth ? ` (the longer side going into the wall is ${referenceDepth} inches)` : ""}.
- The tote height is approximately 14.5 to 15 inches.
- Use the visible ${referenceWidth}-inch face as your measuring ruler.

MEASUREMENT METHOD:
1. Locate the storage tote in the image — it is placed on the floor against the wall.
2. Measure how many times the tote's visible width (${referenceWidth}") fits across the full wall width. Multiply that count by ${referenceWidth} to get wall width in inches.
3. For wall height: estimate how many tote-widths tall the wall is (floor to ceiling), or use the tote height (~14.75") as a vertical reference if visible.
4. The wall boundaries are defined by corners, door frames, or other clear vertical/horizontal edges.

CRITICAL — PERSPECTIVE DISTORTION CORRECTION:
- Camera photos ALWAYS make walls appear wider than they actually are due to lens distortion and perspective.
- The tote is a 3D object sitting on the floor against the wall. Its visible face may appear slightly wider in the photo than its actual ${referenceWidth}" due to the camera angle looking slightly down at it.
- When counting how many tote-widths fit across the wall, you MUST account for perspective foreshortening: parts of the wall farther from the camera appear compressed. Do NOT simply extrapolate the tote size linearly across the image.
- BIAS CORRECTION: Phone cameras at typical shooting distances (6-12 feet) tend to overestimate wall width by 15-25%. After your initial estimate, apply a conservative reduction of about 10-15% to correct for this systematic bias.
- Cross-check: if the tote is near one edge, mentally "walk" the tote width across the wall, making each successive tote slightly smaller as it recedes from the camera.
- If the image was taken at an angle (not perpendicular to the wall), the distortion is even greater — apply a stronger correction.

HEIGHT ESTIMATION:
- ALWAYS attempt to estimate the wall height, even if the photo is taken at an angle.
- Use the tote height (~14.75") as a vertical ruler. Count how many tote-heights from floor to ceiling.
- If the ceiling is slightly cut off or the angle makes it uncertain, still provide your best estimate and mark confidence accordingly.
- Standard garage walls are 96" (8ft) or 120" (10ft). Standard room walls are 96" (8ft). Use these as sanity checks.
- Only omit heightInches if the ceiling and floor are both completely invisible in the image.

COMMON WALL SIZES (for sanity check):
- Garage walls are typically 96" to 120" tall (8-10 ft) and 100" to 240" wide.
- Standard room walls are 96" tall (8 ft).
- If your width estimate exceeds 200", double-check — very few residential walls exceed 240" (20 ft).
- If your estimate is significantly outside these ranges, reconsider your measurement.

ACCURACY GUIDELINES:
- "high" confidence: Tote clearly visible, wall edges clearly defined, minimal perspective distortion, photo taken straight-on
- "medium" confidence: Tote visible but photo at slight angle, or wall edges partially obscured
- "low" confidence: Significant perspective distortion, tote partially hidden, angled photo, or unclear wall boundaries

Return your best estimate. It's better to slightly underestimate than overestimate — a smaller measurement is safer for fitting storage units.`;

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
