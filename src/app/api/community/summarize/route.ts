// ═══════════════════════════════════════════════════════════════════════════
// THREAD SUMMARIZATION API — Gemini-powered TL;DR for active threads
// Pro Feature: Generates concise summaries of lengthy discussions.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getChatModel, hasChatProvider } from "@/lib/ai-provider";
import { generateText } from "ai";

// TODO: Implement Gemini automated moderation and quality scoring

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postTitle, postContent, comments } = body as {
      postTitle: string;
      postContent: string;
      comments: Array<{ author: string; content: string; depth: number }>;
    };

    if (!postTitle || !comments || comments.length === 0) {
      return NextResponse.json(
        { error: "Post title and comments are required" },
        { status: 400 }
      );
    }

    if (!hasChatProvider()) {
      return NextResponse.json(
        { error: "AI API key not configured" },
        { status: 500 }
      );
    }

    const model = getChatModel();

    const systemMessage = `You are a thread summarizer for a professional community forum used by storage system installers and builders. Your job is to generate a concise, useful "TL;DR" summary that helps busy professionals understand the key points of a lengthy discussion thread.

Rules:
- Keep the summary to 2-4 sentences max.
- Focus on actionable insights, consensus opinions, and key recommendations.
- If there's disagreement, note both sides briefly.
- Use professional but accessible language.
- Mention specific techniques, products, or advice if relevant.
- Do NOT use markdown formatting — plain text only.`;

    // Format comments into a readable thread
    const threadText = comments
      .map((c) => {
        const indent = "  ".repeat(c.depth);
        return `${indent}${c.author}: ${c.content}`;
      })
      .join("\n");

    const userMessage = `Summarize this thread:

Title: ${postTitle}
Original Post: ${postContent}

Discussion (${comments.length} comments):
${threadText}`;

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await generateText({
          model,
          system: systemMessage,
          prompt: userMessage,
        });

        return NextResponse.json({ summary: result.text.trim() });
      } catch (err: unknown) {
        lastError = err;
        const errMsg =
          err instanceof Error ? err.message : JSON.stringify(err);
        const isRateLimit =
          errMsg.includes("429") ||
          errMsg.includes("quota") ||
          errMsg.includes("RESOURCE_EXHAUSTED");
        if (!isRateLimit || attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
      }
    }
    throw lastError;
  } catch (error: unknown) {
    console.error("Thread summarization error:", error);
    const message =
      error instanceof Error ? error.message : String(error);

    if (
      message.includes("429") ||
      message.includes("quota") ||
      message.includes("rate")
    ) {
      return NextResponse.json(
        { error: "AI rate limit reached. Please try again shortly." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Summarization failed: ${message}` },
      { status: 500 }
    );
  }
}
