import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getPlanById } from "@/lib/plans-config";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const planId = searchParams.get("plan_id");

  if (!token || !planId) {
    return new NextResponse("Missing token or plan_id", { status: 400 });
  }

  const plan = getPlanById(planId);
  if (!plan) return new NextResponse("Plan not found", { status: 404 });

  // Validate the token matches the plan
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("public_plan_purchases")
    .select("id")
    .eq("access_token", token)
    .eq("plan_id", planId)
    .single();

  if (error || !data) {
    return new NextResponse("Invalid or expired access token", { status: 403 });
  }

  try {
    const filePath = path.join(process.cwd(), "private", plan.htmlFile);
    const html = await fs.readFile(filePath, "utf-8");
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch {
    return new NextResponse("Plans file not found", { status: 500 });
  }
}
