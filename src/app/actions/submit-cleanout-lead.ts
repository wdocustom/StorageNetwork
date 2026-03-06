"use server";

import { getDepositAmount } from "@/app/actions/fee-engine";
import { getServiceClient } from "@/lib/supabase-server";

const supabase = getServiceClient();

export interface CleanOutInput {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  installer_id: string;
  service_type: "1_car" | "2_car";
  add_tote_organizer: boolean;
  source?: "platform" | "partner_link";
  /** Custom price for 1-car cleanout (from installer's services_config) */
  custom_price_1car?: number;
  /** Custom price for 2-car cleanout (from installer's services_config) */
  custom_price_2car?: number;
}

const DEFAULT_PRICES = {
  "1_car": 349,
  "2_car": 549,
  tote_organizer: 500,
} as const;

function getCleanOutTotal(
  serviceType: "1_car" | "2_car",
  addToteOrganizer: boolean,
  customPrice1Car?: number,
  customPrice2Car?: number,
): number {
  const price = serviceType === "1_car"
    ? (customPrice1Car ?? DEFAULT_PRICES["1_car"])
    : (customPrice2Car ?? DEFAULT_PRICES["2_car"]);
  return price + (addToteOrganizer ? DEFAULT_PRICES.tote_organizer : 0);
}

export async function submitCleanOutLead(input: CleanOutInput): Promise<{
  success: boolean;
  id?: string;
  totalPrice?: number;
  depositAmount?: number;
  error?: string;
}> {
  if (!input.customer_name?.trim()) {
    return { success: false, error: "Name is required." };
  }
  if (!input.customer_email?.trim()) {
    return { success: false, error: "Email is required." };
  }
  if (!input.customer_phone?.trim()) {
    return { success: false, error: "Phone is required." };
  }

  const totalPrice = getCleanOutTotal(
    input.service_type,
    input.add_tote_organizer,
    input.custom_price_1car,
    input.custom_price_2car,
  );
  const servicePrice = input.service_type === "1_car"
    ? (input.custom_price_1car ?? DEFAULT_PRICES["1_car"])
    : (input.custom_price_2car ?? DEFAULT_PRICES["2_car"]);
  const serviceLabel = input.service_type === "1_car" ? "1-Car Garage" : "2-Car Garage";

  try {
    const depositAmount = await getDepositAmount(totalPrice, input.installer_id);
    const balanceDue = Math.round((totalPrice - depositAmount) * 100) / 100;

    const notes = [
      `Garage/Basement Clean Out - ${serviceLabel} ($${servicePrice})`,
      input.add_tote_organizer ? `+ 4x4 Tote Organizer System ($${DEFAULT_PRICES.tote_organizer})` : null,
      `Grand Total: $${totalPrice}`,
    ]
      .filter(Boolean)
      .join("\n");

    const quoteData = [
      {
        cols: 0,
        rows: 0,
        toteType: "cleanout",
        hasTotes: input.add_tote_organizer,
        hasWheels: false,
        hasTop: false,
        price: servicePrice,
        totalW: 0,
        totalH: 0,
        desc: `Garage/Basement Clean Out - ${serviceLabel}`,
      },
      ...(input.add_tote_organizer
        ? [
            {
              cols: 4,
              rows: 4,
              toteType: "standard",
              hasTotes: true,
              hasWheels: false,
              hasTop: false,
              price: DEFAULT_PRICES.tote_organizer,
              totalW: 0,
              totalH: 0,
              desc: "4x4 Tote Organizer System (Bundle Add-On)",
            },
          ]
        : []),
    ];

    const { data, error } = await supabase
      .from("leads")
      .insert({
        installer_id: input.installer_id,
        is_network_lead: true,
        customer_name: input.customer_name.trim(),
        customer_email: input.customer_email.trim(),
        customer_phone: input.customer_phone.trim(),
        quote_data: quoteData,
        estimated_price: totalPrice,
        deposit_amount: depositAmount,
        deposit_paid: false,
        balance_due: balanceDue,
        source: input.source || "partner_link",
        status: "pending_payment",
        notes,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Clean-out lead insert failed:", error);
      return { success: false, error: "Failed to create booking. Please try again." };
    }

    return {
      success: true,
      id: data.id,
      totalPrice,
      depositAmount,
    };
  } catch (err: any) {
    console.error("Clean-out lead submission failed:", err);
    return { success: false, error: err.message || "Failed to submit." };
  }
}
