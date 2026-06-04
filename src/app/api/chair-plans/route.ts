import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";

// Serves the chair plans HTML file only to authenticated users who have purchased.
// File is stored at /private/chair-plans.html — NOT in public/, so Vercel never
// serves it directly. Auth check runs on every request; no caching.

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = getServiceClient();

  // Admin bypass — check is_admin first (safe, always exists from migration 031)
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (adminProfile?.is_admin === true) {
    return serveFile();
  }

  // Purchase check — plan OR bundle purchase both grant access
  const { data: profile } = await supabase
    .from("profiles")
    .select("chair_plan_purchased, chair_template_purchased")
    .eq("id", user.id)
    .single();

  const hasAccess =
    profile?.chair_plan_purchased === true ||
    profile?.chair_template_purchased === true;

  if (!hasAccess) {
    return NextResponse.redirect(`${origin}/dashboard/guides`);
  }

  return serveFile();
}

function serveFile() {
  try {
    const html = readFileSync(join(process.cwd(), "private", "chair-plans.html"), "utf-8");
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Plans file not found. Please contact support.", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
