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
import { getAuthenticatedUser } from "@/lib/auth";

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
  // Conservative values — slight correction for edge stretching
  const k1 = 0.06;
  const k2 = 0.02;

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

  // Also compute width using the height-based scale as a cross-check
  let widthFromHeightScale: number | undefined;

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

      // Cross-validate: compute inches-per-pixel from height, apply to width
      const inchesPerPixelFromHeight = TOTE_HEIGHT_INCHES / correctedToteHeight;
      widthFromHeightScale = correctedWallWidth * inchesPerPixelFromHeight;
    }
  } else {
    // Fallback: simple ratio without distortion correction
    widthInches = (wallPixelWidth / totePixelWidth) * referenceWidth;
    if (bb.heightVisible) {
      heightInches = (wallPixelHeight / totePixelHeight) * TOTE_HEIGHT_INCHES;

      // Cross-validate using height scale
      const inchesPerPixelFromHeight = TOTE_HEIGHT_INCHES / totePixelHeight;
      widthFromHeightScale = wallPixelWidth * inchesPerPixelFromHeight;
    }
  }

  // Cross-validation: if width estimates from horizontal and vertical scales
  // disagree significantly, use the larger value (AI tends to underestimate
  // wall boundaries, so the larger estimate is usually more accurate)
  if (widthFromHeightScale !== undefined) {
    const widthRatio = widthFromHeightScale / widthInches;
    // If the height-based estimate is >20% larger, blend toward the larger value
    if (widthRatio > 1.2) {
      widthInches = Math.max(widthInches, widthFromHeightScale);
    }
  }

  // Sanity clamps — reasonable range for storage units and garages
  widthInches = Math.max(36, Math.min(widthInches, 300));
  if (heightInches !== undefined) {
    heightInches = Math.max(60, Math.min(heightInches, 168));
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
  // SECURITY (H-1): premium Vision endpoint — installer-only. Reject anon
  // callers before initializing the Google AI client.
  const authedUser = await getAuthenticatedUser();
  if (!authedUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const imageDimsHint = imageWidth && imageHeight
      ? `\nIMAGE DIMENSIONS: This image is ${imageWidth}px wide × ${imageHeight}px tall. Use these to calibrate your pixel coordinate estimates.`
      : "";

    const systemPrompt = `You are an expert at identifying objects and boundaries in construction/storage-unit photos. Your job is to return PIXEL COORDINATES — not measurements.

WHAT'S IN THE IMAGE:
- A storage tote (plastic bin) is placed on the floor against a wall. The tote is a SMALL reference object compared to the wall.
- The visible face of the tote (the short side, facing the camera) is exactly ${referenceWidth} inches wide.
${referenceDepth ? `- The longer side going into the wall is ${referenceDepth} inches.` : ""}
- The tote height is approximately 14.5 to 15 inches.
- IMPORTANT: The wall is MUCH larger than the tote — typically 5x to 10x wider. A typical storage unit or garage wall is 10-15 feet (120-180 inches) wide and 7-10 feet (84-120 inches) tall.
${imageDimsHint}

YOUR TASK — RETURN BOUNDING BOXES:
1. Locate the storage tote in the image. Return the pixel coordinates of its LEFT edge, RIGHT edge, TOP edge, and BOTTOM edge as seen in the photo.
2. Locate the FULL wall section being measured. Return the pixel coordinates of the wall's LEFT boundary, RIGHT boundary, TOP (ceiling), and BOTTOM (floor).

CRITICAL — WALL BOUNDARY DETECTION:
- The wall boundaries should span the ENTIRE measurable wall section, from its leftmost edge to its rightmost edge.
- For storage units: the wall spans the full width of the roll-up door opening, from the left door track/frame to the right door track/frame.
- For garages: the wall spans the full interior width between the side walls.
- The wall boundaries often extend to or very near the edges of the photo. Do NOT underestimate the wall span.
- Look for the structural boundaries: door frames, corner joints, wall-to-wall transitions, or where the wall meets a perpendicular surface.
- The wall TOP should be the ceiling line or top of the door opening. The wall BOTTOM should be the floor line.
- Set heightVisible to true ONLY if you can clearly see both the floor and ceiling lines.

TOTE DETECTION:
- The tote is a small rectangular plastic bin on the floor. It will appear relatively small compared to the wall.
- Identify the face of the tote visible to the camera. The left/right edges should mark the visible width of ONLY that face — do not include shadows or the lid overhang.
- The tote top/bottom edges should mark the visible height of the tote body.

PIXEL COORDINATE GUIDELINES:
- Return X/Y pixel coordinates relative to the top-left corner of the image (0,0).
- Be as precise as possible with pixel positions. Do NOT round to nice numbers — use your best estimate of the exact pixel.
- If a wall edge extends to or beyond the image frame, set that coordinate to the image edge (0 for left/top, image width for right, image height for bottom).

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
