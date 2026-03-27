import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/inventory/scan
// AI-powered tote content identification from a photo.
//
// Customer snaps a photo of the contents of an open tote. Gemini Vision
// identifies every visible item, estimates quantities, and suggests
// categories. Returns a structured list ready to insert into inventory.
//
// No auth required — the client sends the rack access_token for validation
// but the AI processing doesn't need it (we validate on the insert side).
// ═══════════════════════════════════════════════════════════════════════════

const ItemSchema = z.object({
  name: z.string().describe("Short, clear name for the item (e.g. 'Garden Gloves', 'Extension Cord', 'Christmas Lights')"),
  quantity: z.number().int().min(1).describe("Estimated count of this item visible in the photo"),
  category: z.enum([
    "Holiday", "Tools", "Sports", "Kids", "Kitchen",
    "Clothing", "Electronics", "Documents", "Camping", "Crafts",
    "Garden", "Auto", "Office", "Medical", "Cleaning", "Other",
  ]).describe("Best-fit category for this item"),
});

const ScanResultSchema = z.object({
  items: z.array(ItemSchema).describe("All identifiable items visible in the photo"),
  toteDescription: z.string().describe("One-sentence summary of what this tote contains overall, e.g. 'Gardening supplies and outdoor tools'"),
  confidence: z.enum(["high", "medium", "low"]).describe("How confident the identification is based on image clarity"),
});

export type ScanResult = z.infer<typeof ScanResultSchema>;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, imageUrl } = body as {
      imageBase64?: string;
      imageUrl?: string;
    };

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: "Either imageBase64 or imageUrl is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error("[InventoryScan] Missing GOOGLE_GENERATIVE_AI_API_KEY");
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }

    const google = createGoogleGenerativeAI({ apiKey });

    // Build the image content for Gemini
    const imageContent = imageBase64
      ? {
          type: "image" as const,
          image: imageBase64,
        }
      : {
          type: "image" as const,
          image: new URL(imageUrl!),
        };

    const { object: result } = await generateObject({
      model: google("gemini-2.0-flash"),
      schema: ScanResultSchema,
      messages: [
        {
          role: "user",
          content: [
            imageContent,
            {
              type: "text",
              text: `You are a home inventory assistant. Analyze this photo of items inside a storage tote or bin.

Identify every distinct item you can see. Be specific with names — use common household terms people would search for later (e.g. "red Christmas ornaments" not just "decorations", "cordless drill" not just "tool").

Rules:
- List EVERY visible item, even partially visible ones
- Estimate quantities (e.g. if you see a stack of 3 boxes, quantity = 3)
- Pick the most fitting category for each item
- If items are in bags or sub-containers, describe what's visible
- Be concise with names (2-4 words each)
- If the image is blurry or unclear, still try your best but set confidence to "low"
- The toteDescription should be a natural label someone would give this tote

This is for a home storage inventory system — accuracy matters because the customer will search for these items later.`,
            },
          ],
        },
      ],
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[InventoryScan] AI scan failed:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze photo. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
