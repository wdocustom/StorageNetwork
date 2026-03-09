import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { DEFAULT_SERVICES, type ServiceOffering } from "@/config/services";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/upsell/service?lead=<leadId>&service=<serviceId>
// Returns service details (name, description, price) for the upsell page
// ═══════════════════════════════════════════════════════════════════════════

function getDb() {
  return getServiceClient();
}

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("lead");
  const serviceId = req.nextUrl.searchParams.get("service");

  if (!leadId || !serviceId) {
    return NextResponse.json({ success: false, error: "Missing parameters" }, { status: 400 });
  }

  try {
    // Fetch lead → installer_id
    const { data: lead } = await getDb()
      .from("leads")
      .select("installer_id")
      .eq("id", leadId)
      .single();

    if (!lead?.installer_id) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    // Fetch installer's services_config
    const { data: profile } = await getDb()
      .from("profiles")
      .select("services_config, business_name")
      .eq("id", lead.installer_id)
      .single();

    const servicesConfig = (profile?.services_config as ServiceOffering[] | null) ?? DEFAULT_SERVICES;
    const service = servicesConfig.find((s) => s.id === serviceId && s.enabled);

    if (!service || service.price === null) {
      return NextResponse.json({ success: false, error: "Service not available" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      service: {
        id: service.id,
        name: service.name,
        description: service.description,
        price: service.price,
      },
      installerName: profile?.business_name || "Your Installer",
    });
  } catch (err) {
    console.error("[UpsellService] Error:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
