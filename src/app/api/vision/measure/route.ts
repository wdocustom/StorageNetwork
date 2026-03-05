// ═══════════════════════════════════════════════════════════════════════════
// VISION MEASURE API — AI-powered wall measurement using tote as reference
// ═══════════════════════════════════════════════════════════════════════════
//
// APPROACH: Hybrid bounding-box method
// 1. Gemini returns pixel coordinates for tote & wall boundaries
// 2. Server does deterministic ratio math
// 3. Server applies radial (barrel) distortion correction
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// ── Public Response Type (unchanged — ScanWizard depends on this) ────────
const MeasurementResultSchema = z.object({
  widthInches: z.number().describe("The estimated wall width in inches"),
  heightInches: z.number().optional().describe("The estimated wall height in inches, if visible"),
  confidence: z.enum(["high", "medium", "low"]).describe("Confidence level of the measurement"),
  reasoning: z.string().describe("Brief explanation of how the measurement was derived"),
});

export type MeasurementResult = z.infer<typeof MeasurementResultSchema>;

// ── AI Bounding-Box Schema (internal — what Gemini actually returns) ─────
const BoundingBoxSchema = z.object({
  tote: z.object({
    leftX: z.number().describe("X pixel coordinate of the tote's left edge"),
    rightX: z.number().describe("X pixel coordinate of the tote's right edge"),
    topY: z.number().describe("Y pixel coordinate of the tote's top edge"),
    bottomY: z.number().describe("Y pixel coordinate of the tote's bottom edge"),
  }).describe("Bounding box of the reference tote's visible face"),

  wall: z.object({
    leftX: z.number().describe("X pixel coordinate of the wall's left boundary"),
    rightX: z.number().describe("X pixel coordinate of the wall's right boundary"),
    topY: z.number().describe("Y pixel coordinate of the ceiling/top of wall"),
    bottomY: z.number().describe("Y pixel coordinate of the floor/bottom of wall"),
  }).describe("Bounding box of the full wall section being measured"),

  heightVisible: z.boolean().describe("True if both floor and ceiling are clearly visible in the image"),

  confidence: z.enum(["high", "medium", "low"]).describe("Confidence in boundary detection"),
  reasoning: z.string().describe("Brief explanation of what was detected and any concerns"),
});

type BoundingBox = z.infer<typeof BoundingBoxSchema>;

// ── Request Body Schema ─────────────────────────────────────────────────
const RequestBodySchema = z.object({
  image: z.string().describe("Base64-encoded image data"),
  referenceWidth: z.number().positive().describe("Known width of the tote in inches"),
  referenceDepth: z.number().positive().optional().describe("Known depth of the tote in inches"),
  imageWidth: z.number().positive().optional().describe("Image width in pixels"),
  imageHeight: z.number().positive().optional().describe("Image height in pixels"),
});

// ── Barrel Distortion Correction ─────────────────────────────────────────
// Phone wide-angle lenses cause barrel distortion: pixels near the frame
// edges represent fewer real-world inches than pixels near the center.
// We correct by mapping pixel positions through an inverse radial model.
//
// r_corrected = r_distorted / (1 + k1*r² + k2*r⁴)
//
// k1/k2 are empirical coefficients for typical phone cameras (26-28mm equiv).
// This contracts edge pixels inward, reducing the overestimation.

function correctBarrelDistortion(
  bbox: { leftX: number; rightX: number; topY?: number; bottomY?: number },
  imageWidth: number,
  imageHeight: number,
  axis: "horizontal" | "vertical"
): number {
  // Distortion coefficients for typical smartphone wide-angle lens
  // These are conservative — they correct the ~10-15% overestimate we see
  const k1 = 0.12;
  const k2 = 0.04;

  const cx = imageWidth / 2;
  const cy = imageHeight / 2;
  // Normalize radius so corner = 1.0
  const maxR = Math.sqrt(cx * cx + cy * cy);

  function undistortPoint(px: number, py: number): { x: number; y: number } {
    const dx = (px - cx) / maxR;
    const dy = (py - cy) / maxR;
    const r2 = dx * dx + dy * dy;
    const r4 = r2 * r2;
    const scale = 1 + k1 * r2 + k2 * r4;
    return {
      x: cx + (dx / scale) * maxR,
      y: cy + (dy / scale) * maxR,
    };
  }

  if (axis === "horizontal") {
    const midY = imageHeight / 2;
    const left = undistortPoint(bbox.leftX, midY);
    const right = undistortPoint(bbox.rightX, midY);
    return Math.abs(right.x - left.x);
  } else {
    const midX = (bbox.leftX + bbox.rightX) / 2;
    const top = undistortPoint(midX, bbox.topY!);
    const bottom = undistortPoint(midX, bbox.bottomY!);
    return Math.abs(bottom.y - top.y);
  }
}

// ── Compute final measurements from bounding boxes ───────────────────────
function computeMeasurements(
  bb: BoundingBox,
  referenceWidth: number,
  imageWidth?: number,
  imageHeight?: number
): { widthInches: number; heightInches: number | undefined } {
  const TOTE_HEIGHT_INCHES = 14.75;

  // Raw pixel spans
  const totePixelWidth = Math.abs(bb.tote.rightX - bb.tote.leftX);
  const wallPixelWidth = Math.abs(bb.wall.rightX - bb.wall.leftX);
  const totePixelHeight = Math.abs(bb.tote.bottomY - bb.tote.topY);
  const wallPixelHeight = Math.abs(bb.wall.bottomY - bb.wall.topY);

  let widthInches: number;
  let heightInches: number | undefined;

  if (imageWidth && imageHeight) {
    // Apply barrel distortion correction
    const correctedToteWidth = correctBarrelDistortion(bb.tote, imageWidth, imageHeight, "horizontal");
    const correctedWallWidth = correctBarrelDistortion(bb.wall, imageWidth, imageHeight, "horizontal");

    widthInches = (correctedWallWidth / correctedToteWidth) * referenceWidth;

    if (bb.heightVisible) {
      const correctedToteHeight = correctBarrelDistortion(
        { leftX: bb.tote.leftX, rightX: bb.tote.rightX, topY: bb.tote.topY, bottomY: bb.tote.bottomY },
        imageWidth, imageHeight, "vertical"
      );
      const correctedWallHeight = correctBarrelDistortion(
        { leftX: bb.wall.leftX, rightX: bb.wall.rightX, topY: bb.wall.topY, bottomY: bb.wall.bottomY },
        imageWidth, imageHeight, "vertical"
      );
      heightInches = (correctedWallHeight / correctedToteHeight) * TOTE_HEIGHT_INCHES;
    }
  } else {
    // Fallback: simple ratio without distortion correction
    widthInches = (wallPixelWidth / totePixelWidth) * referenceWidth;
    if (bb.heightVisible) {
      heightInches = (wallPixelHeight / totePixelHeight) * TOTE_HEIGHT_INCHES;
    }
  }

  // Sanity clamps — don't let measurements go wildly out of range
  widthInches = Math.max(36, Math.min(widthInches, 300));
  if (heightInches !== undefined) {
    heightInches = Math.max(72, Math.min(heightInches, 144));
  }

  // Round to nearest 0.5 inch
  widthInches = Math.round(widthInches * 2) / 2;
  if (heightInches !== undefined) {
    heightInches = Math.round(heightInches * 2) / 2;
  }

  return { widthInches, heightInches };
}

// ── API Route Handler ───────────────────────────────────────────────────
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

    const { image, referenceWidth, referenceDepth, imageWidth, imageHeight } = parseResult.data;

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

    // Build the bounding-box detection prompt
    const systemPrompt = `You are an expert at identifying objects and boundaries in construction photos. Your job is to return PIXEL COORDINATES — not measurements.

WHAT'S IN THE IMAGE:
- A storage tote is placed on the floor against a wall.
- The visible face of the tote (facing the camera) is exactly ${referenceWidth} inches wide.
${referenceDepth ? `- The longer side going into the wall is ${referenceDepth} inches.` : ""}
- The tote height is approximately 14.5 to 15 inches.

YOUR TASK — RETURN BOUNDING BOXES:
1. Locate the storage tote in the image. Return the pixel coordinates of its LEFT edge, RIGHT edge, TOP edge, and BOTTOM edge as seen in the photo.
2. Locate the wall section being measured. Return the pixel coordinates of the wall's LEFT boundary, RIGHT boundary, TOP (ceiling), and BOTTOM (floor).

IMPORTANT GUIDELINES:
- Return X/Y pixel coordinates relative to the top-left corner of the image (0,0).
- For the tote: identify the face of the tote visible to the camera. The left/right edges should mark the visible width of that face.
- For the wall: identify the clear boundaries — corners, door frames, edges where the wall meets another surface or ends.
- The wall TOP should be the ceiling line. The wall BOTTOM should be the floor line.
- Set heightVisible to true ONLY if you can clearly see both the floor and ceiling lines.
- Be as precise as possible with pixel positions. Do NOT round to nice numbers — use your best estimate of the exact pixel.

EDGE DETECTION TIPS:
- Look for vertical lines/corners that define where this wall section starts and ends.
- The tote edges should be crisp and well-defined — use the contrast between the tote and the background.
- If a wall edge is partially occluded, estimate where the true corner would be.

CONFIDENCE:
- "high": Both tote and wall boundaries are clearly visible with sharp edges
- "medium": Some edges are slightly ambiguous or partially occluded
- "low": Significant guesswork required for one or more boundaries`;

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // Call Gemini for bounding boxes
    const result = await generateObject({
      model: google("gemini-2.0-flash"),
      schema: BoundingBoxSchema,
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

    const bb = result.object;

    // Compute measurements server-side with distortion correction
    const { widthInches, heightInches } = computeMeasurements(
      bb,
      referenceWidth,
      imageWidth,
      imageHeight
    );

    // Build reasoning string
    const toteW = Math.abs(bb.tote.rightX - bb.tote.leftX);
    const wallW = Math.abs(bb.wall.rightX - bb.wall.leftX);
    const rawRatio = wallW / toteW;
    const correctionApplied = imageWidth && imageHeight;
    const reasoning = `${bb.reasoning} | Tote: ${toteW.toFixed(0)}px wide, Wall: ${wallW.toFixed(0)}px wide (${rawRatio.toFixed(2)}x ratio). ${correctionApplied ? "Barrel distortion correction applied." : "No distortion correction (image dimensions not provided)."}`;

    // Return in the same shape ScanWizard expects
    const measurement: MeasurementResult = {
      widthInches,
      heightInches,
      confidence: bb.confidence,
      reasoning,
    };

    return NextResponse.json({
      success: true,
      measurement,
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
