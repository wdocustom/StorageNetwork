"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import { calculateMaterialCostServer } from "@/app/actions/calculate-materials";
import type { MaterialConfig, MaterialPrices } from "@/utils/calculateMaterials";
import type { MaterialPricingConfig } from "@/app/actions/material-pricing";
import { roundMoney } from "@/utils/mathHelpers";

const supabase = getServiceClient();

// Thrown when a caller is unauthenticated or attempts to read another
// installer's sales data. The "UNAUTHORIZED:" prefix is the contract that
// the boundary treats as HTTP 401. Plain Error (not a custom class) because
// "use server" modules may only export async functions.
function unauthorized(message: string): Error {
  const err = new Error(`UNAUTHORIZED: ${message}`);
  (err as Error & { status?: number }).status = 401;
  return err;
}

// ═══════════════════════════════════════════════════════════════════════════
// Sales Insights — Aggregated sales data for the installer CRM
//
// Fetches all completed (paid) jobs for an installer and computes:
//   - Total sales revenue
//   - Total cost of goods (materials)
//   - Order count
//   - Per-order breakdown with customer info, config details, dates
//   - Unit popularity rankings (for bestseller campaigns)
// ═══════════════════════════════════════════════════════════════════════════

export interface OrderDetail {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  address: string | null;
  status: string;
  source: string | null;
  operationalStatus: string;
  totalPrice: number;
  materialCost: number;
  profit: number;
  feeAmount: number;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  units: {
    desc: string;
    cols: number;
    rows: number;
    toteType: string;
    hasTotes: boolean;
    hasWheels: boolean;
    hasTop: boolean;
    price: number;
  }[];
}

export interface UnitPopularity {
  config: string;
  count: number;
  totalRevenue: number;
  details: { toteType: string; hasTotes: boolean; hasWheels: boolean; hasTop: boolean };
}

export interface SalesInsightsData {
  totalSales: number;
  totalCOGS: number;
  totalFees: number;
  netPayout: number;
  totalOrders: number;
  totalTotesOrdered: number;
  totalUnitsBuilt: number;
  orders: OrderDetail[];
  popularUnits: UnitPopularity[];
}

export async function getSalesInsights(
  installerId?: string
): Promise<SalesInsightsData> {
  // SECURITY (C-1 hotfix): the caller-supplied installerId is NEVER trusted.
  // The authoritative installer id is resolved from the session cookie via
  // supabase.auth.getUser(). If a client passes an installerId that does not
  // match the session, we throw a 401 Unauthorized.
  const user = await getAuthenticatedUser();
  if (!user) {
    throw unauthorized("not authenticated");
  }
  if (installerId && installerId !== user.id) {
    throw unauthorized("cannot access another installer's sales data");
  }
  const resolvedInstallerId = user.id;

  // Fee rates (mirrored from fee-engine — server-only constants)
  const NETWORK_FEE_RATE = 0.15;
  const MAINTENANCE_FEE_RATE = 0.03;

  // Fetch all completed/paid jobs for this installer
  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, customer_name, customer_email, customer_phone, address, status, source, estimated_price, balance_due, quote_data, scheduled_at, completed_at, created_at, fee_status, deposit_amount, operational_status, delivery_address_line1, delivery_address_city, delivery_address_state, delivery_address_zip"
    )
    .eq("installer_id", resolvedInstallerId)
    .in("status", ["paid", "payment_pending"])
    .order("completed_at", { ascending: false, nullsFirst: false });

  if (error || !leads) {
    console.error("[SalesInsights] Fetch failed:", error);
    return {
      totalSales: 0,
      totalCOGS: 0,
      totalFees: 0,
      netPayout: 0,
      totalOrders: 0,
      totalTotesOrdered: 0,
      totalUnitsBuilt: 0,
      orders: [],
      popularUnits: [],
    };
  }

  // Load installer's custom material pricing for accurate COGS
  let customPrices: MaterialPrices | undefined;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("material_pricing_config")
      .eq("id", resolvedInstallerId)
      .single();
    if (profile?.material_pricing_config) {
      const mpc = profile.material_pricing_config as MaterialPricingConfig;
      const p: Record<string, number> = {};
      if (mpc.lumber_2x4_8ft !== undefined) p.lumber_2x4_8ft = mpc.lumber_2x4_8ft;
      if (mpc.plywood_sheet !== undefined) p.plywood_sheet = mpc.plywood_sheet;
      if (mpc.tote !== undefined) p.tote = mpc.tote;
      if (mpc.wheels_4pk !== undefined) p.wheels_4pk = mpc.wheels_4pk;
      if (mpc.screw_1in) p.screw_1in_90ct = mpc.screw_1in.price / mpc.screw_1in.count * 90;
      if (mpc.screw_1_5_8in) p.screw_1_5_8in_158ct = mpc.screw_1_5_8in.price / mpc.screw_1_5_8in.count * 158;
      if (mpc.screw_3in) p.screw_3in_137ct = mpc.screw_3in.price / mpc.screw_3in.count * 137;
      if (Object.keys(p).length > 0) customPrices = p as MaterialPrices;
    }
  } catch {
    // Fall through to default pricing
  }

  let totalSales = 0;
  let totalCOGS = 0;
  let totalFees = 0;
  let totalTotes = 0;
  let totalUnits = 0;
  const orders: OrderDetail[] = [];
  const configCounts: Record<string, { count: number; revenue: number; details: UnitPopularity["details"] }> = {};

  for (const lead of leads) {
    const quoteData = Array.isArray(lead.quote_data)
      ? (lead.quote_data as MaterialConfig[])
      : [];
    const totalPrice = lead.estimated_price || lead.balance_due || 0;

    // Calculate material cost from quote data
    let materialCost = 0;
    if (quoteData.length > 0) {
      try {
        const breakdown = await calculateMaterialCostServer(quoteData, customPrices);
        materialCost = breakdown.totalCost;
        totalTotes += breakdown.rawCounts.totes;
      } catch {
        // If calculation fails, estimate 40% material cost
        materialCost = Math.round(totalPrice * 0.4);
      }
    }

    // Calculate platform fee based on lead source
    const isNetworkLead = lead.source === "network" || lead.source === "referral";
    const feeRate = isNetworkLead ? NETWORK_FEE_RATE : MAINTENANCE_FEE_RATE;
    const feeAmount = roundMoney(totalPrice * feeRate);

    totalSales += totalPrice;
    totalCOGS += materialCost;
    totalFees += feeAmount;
    totalUnits += quoteData.length;

    // Build delivery address string
    const deliveryAddr = [
      lead.delivery_address_line1,
      lead.delivery_address_city,
      lead.delivery_address_state,
      lead.delivery_address_zip,
    ]
      .filter(Boolean)
      .join(", ");

    type QuoteUnit = MaterialConfig & { desc?: string; price?: number };
    const units = (quoteData as QuoteUnit[]).map((u) => ({
      desc: u.desc || `${u.cols}x${u.rows}`,
      cols: u.cols || 0,
      rows: u.rows || 0,
      toteType: u.toteType || "HDX",
      hasTotes: u.hasTotes ?? false,
      hasWheels: u.hasWheels ?? false,
      hasTop: u.hasTop ?? false,
      price: u.price || 0,
    }));

    // Derive operational status from existing data if not explicitly set
    const opStatus: string =
      lead.operational_status ||
      (lead.status === "paid" || lead.status === "payment_pending"
        ? "completed"
        : lead.scheduled_at
          ? "scheduled"
          : "new");

    orders.push({
      id: lead.id,
      customerName: lead.customer_name || "Unknown",
      customerEmail: lead.customer_email,
      customerPhone: lead.customer_phone,
      address: deliveryAddr || lead.address || null,
      status: lead.status,
      source: lead.source,
      operationalStatus: opStatus,
      totalPrice,
      materialCost,
      profit: Math.max(0, totalPrice - materialCost),
      feeAmount,
      scheduledAt: lead.scheduled_at,
      completedAt: lead.completed_at,
      createdAt: lead.created_at,
      units,
    });

    // Track unit popularity
    for (const u of units) {
      const key = `${u.cols}x${u.rows} ${u.toteType}${u.hasTotes ? " +Totes" : ""}${u.hasWheels ? " +Wheels" : ""}${u.hasTop ? " +Top" : ""}`;
      if (!configCounts[key]) {
        configCounts[key] = {
          count: 0,
          revenue: 0,
          details: {
            toteType: u.toteType,
            hasTotes: u.hasTotes,
            hasWheels: u.hasWheels,
            hasTop: u.hasTop,
          },
        };
      }
      configCounts[key].count++;
      configCounts[key].revenue += u.price;
    }
  }

  // Sort popular units by count desc
  const popularUnits: UnitPopularity[] = Object.entries(configCounts)
    .map(([config, data]) => ({
      config,
      count: data.count,
      totalRevenue: data.revenue,
      details: data.details,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalSales: Math.round(totalSales),
    totalCOGS: Math.round(totalCOGS),
    totalFees: Math.round(totalFees),
    netPayout: Math.round(totalSales - totalFees),
    totalOrders: leads.length,
    totalTotesOrdered: totalTotes,
    totalUnitsBuilt: totalUnits,
    orders,
    popularUnits,
  };
}
