"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { resolveMarketingAttribution } from "@/lib/marketing-attribution";
import { extractPastUnits, pickInstallAddress } from "@/lib/repeat-order-units";
import { calculateBuild } from "@/app/actions/calculator";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import type { InstallerPricing } from "@/types/viewModels";

// ═══════════════════════════════════════════════════════════════════════════
// Repeat-order context for /book/<installer>?mc=<token>
//
// Gated by the campaign token: it must exist, be issued for THIS installer,
// and be inside the attribution window (same check that grants the network
// fee). Without a valid token nothing is returned, so the booking page never
// reveals customer details to anyone else.
//
// Prices are computed here with the installer's own pricing — never copied
// from the old order — so the customer sees what the installer charges today.
// ═══════════════════════════════════════════════════════════════════════════

export interface RepeatOrderUnit {
  key: string;
  available: boolean;
  unavailableLabel?: string;
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  quantity: number;
  price: number;
  totalW: number;
  totalH: number;
}

export interface RepeatOrderContext {
  installer: { name: string; avatarUrl: string | null; location: string | null };
  customer: { name: string; email: string; phone: string; address: string; zip: string };
  units: RepeatOrderUnit[];
}

export async function getRepeatOrderContext(
  token: string,
  installerId: string
): Promise<{ success: true; context: RepeatOrderContext } | { success: false }> {
  try {
    await enforceActionRateLimit({ action: "repeat-order-context", limit: 30, window: "1 h", identify: "ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { success: false };
    throw err;
  }

  const db = getServiceClient();
  const attribution = await resolveMarketingAttribution(db, token, installerId);
  if (!attribution) return { success: false };

  const { data: send } = await db
    .from("marketing_email_sends")
    .select("email, source_lead_id")
    .eq("id", attribution.sendId)
    .maybeSingle();
  if (!send) return { success: false };

  const [{ data: installer }, { data: lead }] = await Promise.all([
    db
      .from("profiles")
      .select("business_name, first_name, avatar_url, city, state, pricing_config")
      .eq("id", installerId)
      .maybeSingle(),
    send.source_lead_id
      ? db
          .from("leads")
          .select(
            "installer_id, customer_name, customer_phone, quote_data, address, address_line1, address_city, address_state, address_zip, delivery_address_line1, delivery_address_line2, delivery_address_city, delivery_address_state, delivery_address_zip"
          )
          .eq("id", send.source_lead_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!installer) return { success: false };

  // The order must belong to this installer; otherwise show no past items.
  const ownLead = lead && lead.installer_id === installerId ? lead : null;
  const pricing = (installer.pricing_config as InstallerPricing | null) ?? undefined;

  const units: RepeatOrderUnit[] = [];
  const pastUnits = extractPastUnits(ownLead?.quote_data);
  for (let i = 0; i < pastUnits.length; i++) {
    const past = pastUnits[i];
    if (past.unavailableLabel || past.cols === undefined) {
      units.push({
        key: `u${i}`, available: false, unavailableLabel: past.unavailableLabel,
        cols: 0, rows: 0, toteType: "HDX", hasTotes: false, hasWheels: false, hasTop: false,
        quantity: 1, price: 0, totalW: 0, totalH: 0,
      });
      continue;
    }
    const res = await calculateBuild({
      cols: past.cols, rows: past.rows!, toteModel: past.toteType!,
      addOns: { totes: !!past.hasTotes, wheels: !!past.hasWheels, top: !!past.hasTop },
      mode: "manual", installerPricing: pricing,
    });
    if (!res.success) continue;
    units.push({
      key: `u${i}`, available: true,
      cols: res.cols, rows: res.rows, toteType: past.toteType!,
      hasTotes: !!past.hasTotes, hasWheels: !!past.hasWheels, hasTop: !!past.hasTop,
      quantity: past.quantity ?? 1,
      price: res.price, totalW: res.dimensions.totalW, totalH: res.dimensions.totalH,
    });
  }

  const addr = ownLead ? pickInstallAddress(ownLead as Record<string, unknown>) : { address: "", zip: "" };
  const location = [installer.city, installer.state].filter(Boolean).join(", ");

  return {
    success: true,
    context: {
      installer: {
        name: (installer.business_name as string) || (installer.first_name as string) || "Your installer",
        avatarUrl: (installer.avatar_url as string) || null,
        location: location || null,
      },
      customer: {
        name: (ownLead?.customer_name as string) || "",
        email: send.email as string,
        phone: (ownLead?.customer_phone as string) || "",
        ...addr,
      },
      units,
    },
  };
}
