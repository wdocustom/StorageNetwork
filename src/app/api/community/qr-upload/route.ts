import { NextRequest, NextResponse } from "next/server";
import { uploadToSession, getSessionImages } from "@/app/actions/qr-upload";

// POST — Upload image from mobile
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = formData.get("token") as string | null;

    if (!token) {
      return NextResponse.json({ error: "Missing session token." }, { status: 400 });
    }

    const result = await uploadToSession(token, formData);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, url: result.url });
  } catch (err) {
    console.error("[QR Upload] Error:", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

// GET — Poll for uploaded images (desktop)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const { images } = await getSessionImages(token);
  return NextResponse.json({ images });
}
