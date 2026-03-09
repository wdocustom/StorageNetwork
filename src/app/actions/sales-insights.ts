"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { calculateMaterialCostServer } from "@/app/actions/calculate-materials";
import type { MaterialConfig } from "@/utils/calculateMaterials";

const supabase = getServiceClient();

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
  installerId: string
): Promise<SalesInsightsData> {
  // Fee rates (mirrored from fee-engine — server-only constants)
  const NETWORK_FEE_RATE = 0.15;
  const MAINTENANCE_FEE_RATE = 0.03;

  // Fetch all completed/paid jobs for this installer
  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, customer_name, customer_email, customer_phone, address, status, source, estimated_price, balance_due, quote_data, scheduled_at, completed_at, created_at, fee_status, deposit_amount, operational_status, delivery_address_line1, delivery_address_city, delivery_address_state, delivery_address_zip"
    )
    .eq("installer_id", installerId)
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
        const breakdown = await calculateMaterialCostServer(quoteData);
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
    const feeAmount = Math.round(totalPrice * feeRate * 100) / 100;

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
